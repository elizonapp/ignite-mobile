import { Capacitor, registerPlugin } from "@capacitor/core";
import { PushNotifications, type Token, type ActionPerformed, type PushNotificationSchema } from "@capacitor/push-notifications";

import { api } from "./api";
import { getDesktopOS, getMobileOS, isElectron, isMobileNative } from "./platform";

const PREF_KEY = "elizon.clientPushEnabled";
const TOKEN_KEY = "elizon.mobilePushDeviceToken";
const WEB_ENDPOINT_KEY = "elizon.desktopPushEndpoint";

type PushNavigateHandler = (target: { serviceId?: string }) => void;

type NotificationSettingsPlugin = {
  areNotificationsEnabled(): Promise<{ enabled: boolean }>;
};

const NotificationSettings = registerPlugin<NotificationSettingsPlugin>("NotificationSettings");

let listenersReady = false;
let registrationInFlight: Promise<boolean> | null = null;
let navigateHandler: PushNavigateHandler | null = null;
let swMessageBound = false;

function canUseNativePush(): boolean {
  return isMobileNative() && Capacitor.isPluginAvailable("PushNotifications");
}

function canUseDesktopWebPush(): boolean {
  return (
    isElectron() &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function canUseClientPush(): boolean {
  return canUseNativePush() || canUseDesktopWebPush();
}

export function getMobilePushPreference(): boolean {
  if (typeof window === "undefined") return false;
  // Migrate legacy key
  const legacy = window.localStorage.getItem("elizon.mobilePushEnabled");
  if (legacy != null && window.localStorage.getItem(PREF_KEY) == null) {
    window.localStorage.setItem(PREF_KEY, legacy);
  }
  return window.localStorage.getItem(PREF_KEY) === "true";
}

export function setMobilePushPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREF_KEY, enabled ? "true" : "false");
}

function getStoredDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function setStoredDeviceToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

function getStoredWebEndpoint(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(WEB_ENDPOINT_KEY);
}

function setStoredWebEndpoint(endpoint: string | null): void {
  if (typeof window === "undefined") return;
  if (endpoint) window.localStorage.setItem(WEB_ENDPOINT_KEY, endpoint);
  else window.localStorage.removeItem(WEB_ENDPOINT_KEY);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function uploadDeviceToken(token: string): Promise<void> {
  const platform = getMobileOS();
  await api.user.registerDeviceToken({
    deviceToken: token,
    platform: platform === "unknown" ? Capacitor.getPlatform() : platform,
    channel: "MOBILE_NATIVE",
  });
  setStoredDeviceToken(token);
}

function extractServiceId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  const direct = record.serviceId;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = record.data;
  if (nested && typeof nested === "object") {
    const nestedId = (nested as Record<string, unknown>).serviceId;
    if (typeof nestedId === "string" && nestedId.trim()) return nestedId.trim();
  }
  return undefined;
}

function bindServiceWorkerMessages(): void {
  if (swMessageBound || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data as { type?: string; serviceId?: string } | null;
    if (data?.type !== "elizon-push-click") return;
    navigateHandler?.({ serviceId: data.serviceId });
  });
  swMessageBound = true;
}

async function ensureListeners(): Promise<void> {
  if (!canUseNativePush() || listenersReady) return;

  await PushNotifications.addListener("registration", (token: Token) => {
    void uploadDeviceToken(token.value).catch(() => {});
  });

  await PushNotifications.addListener("registrationError", () => {});

  await PushNotifications.addListener("pushNotificationReceived", (_notification: PushNotificationSchema) => {});

  await PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
    const serviceId = extractServiceId(action.notification?.data);
    navigateHandler?.({ serviceId });
  });

  listenersReady = true;
}

export function setPushNavigateHandler(handler: PushNavigateHandler | null): void {
  navigateHandler = handler;
  if (handler) bindServiceWorkerMessages();
}

export function getPushDeniedMessageKey():
  | "settingsPushNotificationsDeniedAndroid"
  | "settingsPushNotificationsDeniedIos"
  | "settingsPushNotificationsDeniedDesktop"
  | "settingsPushNotificationsDenied" {
  if (isElectron()) return "settingsPushNotificationsDeniedDesktop";
  const os = getMobileOS();
  if (os === "android") return "settingsPushNotificationsDeniedAndroid";
  if (os === "ios") return "settingsPushNotificationsDeniedIos";
  return "settingsPushNotificationsDenied";
}

async function areAndroidNotificationsEnabled(): Promise<boolean> {
  if (getMobileOS() !== "android") return true;
  if (!Capacitor.isPluginAvailable("NotificationSettings")) return true;
  try {
    const result = await NotificationSettings.areNotificationsEnabled();
    return Boolean(result?.enabled);
  } catch {
    return true;
  }
}

export async function getNativePushPermissionState(): Promise<"granted" | "denied" | "prompt" | "unsupported"> {
  if (canUseNativePush()) {
    const status = await PushNotifications.checkPermissions();
    let state: "granted" | "denied" | "prompt" =
      status.receive === "granted" ? "granted" : status.receive === "denied" ? "denied" : "prompt";
    if (state === "granted" && getMobileOS() === "android") {
      const osEnabled = await areAndroidNotificationsEnabled();
      if (!osEnabled) state = "denied";
    }
    return state;
  }

  if (canUseDesktopWebPush()) {
    const permission = Notification.permission;
    if (permission === "granted") return "granted";
    if (permission === "denied") return "denied";
    return "prompt";
  }

  return "unsupported";
}

async function ensureAndroidDefaultChannel(): Promise<void> {
  if (getMobileOS() !== "android") return;
  try {
    await PushNotifications.createChannel({
      id: "elizon_default",
      name: "elizon",
      description: "Benachrichtigungen zu neuen Aktivitäten auf Ihrem Konto",
      importance: 4,
      visibility: 1,
      sound: "default",
      vibration: true,
    });
  } catch {
    // Channel may already exist.
  }
}

async function registerDesktopWebPush(): Promise<boolean> {
  if (!canUseDesktopWebPush()) return false;
  bindServiceWorkerMessages();

  const keyRes = await api.user.pushPublicKey();
  const publicKey = keyRes?.publicKey;
  if (!publicKey) return false;

  const registration = await navigator.serviceWorker.register("./push-sw.js");
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  const json = subscription.toJSON();
  await api.user.subscribeWebPush({
    platform: "electron",
    subscription: {
      endpoint: json.endpoint,
      keys: {
        auth: json.keys?.auth,
        p256dh: json.keys?.p256dh,
      },
    },
  });
  if (json.endpoint) setStoredWebEndpoint(json.endpoint);
  return true;
}

export async function registerMobilePush(): Promise<boolean> {
  if (canUseDesktopWebPush()) {
    if (!getMobilePushPreference()) return false;
    try {
      return await registerDesktopWebPush();
    } catch {
      return false;
    }
  }

  if (!canUseNativePush()) return false;
  if (!getMobilePushPreference()) return false;

  if (registrationInFlight) return registrationInFlight;

  registrationInFlight = (async () => {
    try {
      await ensureListeners();
      const permission = await getNativePushPermissionState();
      if (permission !== "granted") return false;
      await ensureAndroidDefaultChannel();
      await PushNotifications.register();
      return true;
    } catch {
      return false;
    } finally {
      registrationInFlight = null;
    }
  })();

  return registrationInFlight;
}

export async function enableMobilePush(): Promise<{ ok: boolean; permission: "granted" | "denied" | "prompt" | "unsupported" }> {
  if (!canUseClientPush()) {
    return { ok: false, permission: "unsupported" };
  }

  let permission = await getNativePushPermissionState();

  if (permission === "denied") {
    await disableMobilePush();
    return { ok: false, permission: "denied" };
  }

  if (permission === "prompt") {
    if (canUseNativePush()) {
      await ensureListeners();
      await ensureAndroidDefaultChannel();
      const requested = await PushNotifications.requestPermissions();
      permission = requested.receive === "granted" ? "granted" : requested.receive === "denied" ? "denied" : "prompt";
      if (permission === "granted" && getMobileOS() === "android") {
        const osEnabled = await areAndroidNotificationsEnabled();
        if (!osEnabled) permission = "denied";
      }
    } else if (canUseDesktopWebPush()) {
      const result = await Notification.requestPermission();
      permission = result === "granted" ? "granted" : result === "denied" ? "denied" : "prompt";
    }
  }

  if (permission !== "granted") {
    setMobilePushPreference(false);
    return { ok: false, permission };
  }

  setMobilePushPreference(true);
  const registered = await registerMobilePush();
  return { ok: registered, permission };
}

export async function disableMobilePush(): Promise<void> {
  setMobilePushPreference(false);

  const token = getStoredDeviceToken();
  if (token) {
    try {
      await api.user.disableDeviceToken(token);
    } catch {
      // ignore
    }
    setStoredDeviceToken(null);
  }

  const endpoint = getStoredWebEndpoint();
  if (endpoint) {
    try {
      await api.user.unsubscribeWebPush(endpoint);
    } catch {
      // ignore
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration("./push-sw.js");
      const sub = await registration?.pushManager.getSubscription();
      await sub?.unsubscribe();
    } catch {
      // ignore
    }
    setStoredWebEndpoint(null);
  }

  if (canUseNativePush()) {
    try {
      await PushNotifications.removeAllDeliveredNotifications();
    } catch {
      // optional
    }
    if (getMobileOS() === "android") {
      try {
        await PushNotifications.unregister();
      } catch {
        // ignore
      }
    }
  }
}

function isClientPushExplicitlyOptedOut(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREF_KEY) === "false";
}

export async function reconcileMobilePushWithOsPermission(): Promise<"granted" | "denied" | "prompt" | "unsupported"> {
  if (!canUseClientPush()) return "unsupported";
  const permission = await getNativePushPermissionState();
  if (permission === "denied" || permission === "unsupported") {
    if (getMobilePushPreference() || getStoredDeviceToken() || getStoredWebEndpoint()) {
      await disableMobilePush();
    } else {
      setMobilePushPreference(false);
    }
  }
  return permission;
}

export async function syncMobilePushAfterAuth(): Promise<void> {
  if (!canUseClientPush()) return;

  const permission = await reconcileMobilePushWithOsPermission();
  if (permission === "denied" || permission === "unsupported") return;

  if (isClientPushExplicitlyOptedOut()) return;
  await enableMobilePush();
}

export async function unregisterMobilePushOnLogout(): Promise<void> {
  if (!canUseClientPush()) return;
  const token = getStoredDeviceToken();
  const endpoint = getStoredWebEndpoint();
  if (token) {
    try {
      await api.user.disableDeviceToken(token);
    } catch {
      // ignore
    }
    setStoredDeviceToken(null);
  }
  if (endpoint) {
    try {
      await api.user.unsubscribeWebPush(endpoint);
    } catch {
      // ignore
    }
    setStoredWebEndpoint(null);
  }
  if (canUseNativePush() && getMobileOS() === "android") {
    try {
      await PushNotifications.unregister();
    } catch {
      // ignore
    }
  }
}

/** @deprecated use getDesktopOS via platform — kept for call-site clarity */
export function getClientPushPlatformLabel(): string {
  if (isElectron()) return getDesktopOS();
  return getMobileOS();
}
