import { isMobileNative } from "./platform";

const TOKEN_KEY = "elizon_session_token";

let memoryToken: string | null | undefined;
let initPromise: Promise<void> | null = null;

async function readFromSecureStorage(): Promise<string | null> {
  try {
    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
    const result = await SecureStoragePlugin.get({ key: TOKEN_KEY });
    return typeof result?.value === "string" ? result.value : null;
  } catch {
    return null;
  }
}

async function writeToSecureStorage(token: string): Promise<void> {
  try {
    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
    await SecureStoragePlugin.set({ key: TOKEN_KEY, value: token });
  } catch {
    // Best-effort; in-memory cache still holds the active session.
  }
}

async function removeFromSecureStorage(): Promise<void> {
  try {
    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
    await SecureStoragePlugin.remove({ key: TOKEN_KEY });
  } catch {
    // ignore
  }
}

/** Load persisted token into memory. Call once before auth bootstrap on native. */
export function initSessionToken(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (typeof window === "undefined") {
      memoryToken = null;
      return;
    }
    if (isMobileNative()) {
      memoryToken = await readFromSecureStorage();
      return;
    }
    memoryToken = window.localStorage.getItem(TOKEN_KEY);
  })();
  return initPromise;
}

export function getSessionToken(): string | null {
  if (memoryToken !== undefined) return memoryToken;
  if (typeof window === "undefined") return null;
  if (!isMobileNative()) {
    return window.localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function setSessionToken(token: string): void {
  memoryToken = token;
  if (typeof window === "undefined") return;
  if (isMobileNative()) {
    void writeToSecureStorage(token);
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  memoryToken = null;
  if (typeof window === "undefined") return;
  if (isMobileNative()) {
    void removeFromSecureStorage();
    return;
  }
  window.localStorage.removeItem(TOKEN_KEY);
}
