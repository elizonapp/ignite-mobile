import { Capacitor } from "@capacitor/core";

export type DesktopOS = "darwin" | "win32" | "linux" | "web";
export type MobileOS = "ios" | "android" | "unknown";
export type ElizonClient = "desktop" | "mobile";

export function isElectron(): boolean {
  return typeof navigator !== "undefined" && /Electron\//.test(navigator.userAgent);
}

export function isMobileNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isDesktopClient(): boolean {
  return !isMobileNative();
}

export function getMobileOS(): MobileOS {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return "ios";
  if (platform === "android") return "android";
  return "unknown";
}

export function getDesktopOS(): DesktopOS {
  if (typeof navigator === "undefined") return "web";

  if (isElectron()) {
    const electronProcess = (window as Window & { process?: { platform?: string } }).process;
    const platform = electronProcess?.platform;
    if (platform === "darwin" || platform === "win32" || platform === "linux") {
      return platform;
    }
  }

  const ua = navigator.userAgent;
  if (/Mac OS X|Macintosh/.test(ua)) return "darwin";
  if (/Windows NT|Win32/.test(ua)) return "win32";
  if (/Linux|X11/.test(ua) && !/Android/.test(ua)) return "linux";
  return "web";
}

export function getElizonClientKind(): ElizonClient {
  return isMobileNative() ? "mobile" : "desktop";
}

export function getElizonPlatformHeader(): string {
  return isMobileNative() ? getMobileOS() : getDesktopOS();
}

export function getElizonClientHeaders(): Record<string, string> {
  return {
    "X-Elizon-Client": getElizonClientKind(),
    "X-Elizon-Platform": getElizonPlatformHeader(),
  };
}

/** @alias getElizonClientHeaders */
export function getClientHeaders(): Record<string, string> {
  return getElizonClientHeaders();
}

export function canPurchase(): boolean {
  return isDesktopClient();
}

export function canManageBilling(): boolean {
  return isDesktopClient();
}

/** Wallet overview (balance, subscriptions, payment methods) is available on all clients. */
export function canAccessWallet(): boolean {
  return true;
}
