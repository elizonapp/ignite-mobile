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

/** Desktop macOS (Electron or browser on Mac). Not iOS/Android native apps. */
export function isMacOSDesktop(): boolean {
  if (isMobileNative()) return false;
  return getDesktopOS() === "darwin";
}

/** Floating IPs are unavailable on mobile native (iOS/Android) and macOS. */
export function canAccessFloatingIps(): boolean {
  if (isMobileNative()) {
    const os = getMobileOS();
    return os !== "ios" && os !== "android";
  }
  return getDesktopOS() !== "darwin";
}

/** Purchases are unavailable on macOS desktop; available on other platforms. */
export function canPurchase(): boolean {
  return !isMacOSDesktop();
}

export function canManageBilling(): boolean {
  return true;
}

/** Wallet overview (balance, subscriptions, payment methods) is available on all clients. */
export function canAccessWallet(): boolean {
  return true;
}
