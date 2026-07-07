import { isMobileNative } from "./platform";

const TOKEN_KEY = "elizon_session_token";
const PERSIST_KEY = "elizon_session_persist";

let memoryToken: string | null | undefined;
let persistSession = false;
let initPromise: Promise<void> | null = null;

type StoredSession = {
  token: string | null;
  persist: boolean;
};

function hasElectronSessionBridge(): boolean {
  return typeof window !== "undefined" && typeof window.electron?.session?.get === "function";
}

async function readFromElectronStore(): Promise<StoredSession> {
  if (!hasElectronSessionBridge()) {
    return { token: null, persist: false };
  }
  try {
    const result = await window.electron!.session!.get();
    const token = typeof result?.token === "string" ? result.token : null;
    const persist = result?.persist !== false && !!token;
    return { token, persist };
  } catch {
    return { token: null, persist: false };
  }
}

async function writeToElectronStore(token: string | null, persist: boolean): Promise<void> {
  if (!hasElectronSessionBridge()) return;
  try {
    if (!token || !persist) {
      await window.electron!.session!.clear();
      return;
    }
    await window.electron!.session!.set(token, true);
  } catch {
    // Best-effort; web storage remains as fallback.
  }
}

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

function migrateLegacyWebToken(): void {
  if (typeof window === "undefined") return;
  const legacyToken = window.localStorage.getItem(TOKEN_KEY);
  if (legacyToken && window.localStorage.getItem(PERSIST_KEY) !== "1") {
    window.localStorage.setItem(PERSIST_KEY, "1");
  }
}

function readPersistFlag(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PERSIST_KEY) === "1";
}

function readWebToken(): string | null {
  if (typeof window === "undefined") return null;
  migrateLegacyWebToken();
  if (readPersistFlag()) {
    return window.localStorage.getItem(TOKEN_KEY);
  }
  return window.sessionStorage.getItem(TOKEN_KEY);
}

function writeWebToken(token: string, persist: boolean): void {
  if (typeof window === "undefined") return;

  persistSession = persist;

  if (persist) {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(PERSIST_KEY, "1");
    window.sessionStorage.removeItem(TOKEN_KEY);
    return;
  }

  window.sessionStorage.setItem(TOKEN_KEY, token);
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(PERSIST_KEY);
}

function clearWebToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(PERSIST_KEY);
  window.sessionStorage.removeItem(TOKEN_KEY);
  persistSession = false;
}

/** Load persisted token into memory. Call once before auth bootstrap. */
export function initSessionToken(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (typeof window === "undefined") {
      memoryToken = null;
      return;
    }

    if (isMobileNative()) {
      memoryToken = await readFromSecureStorage();
      persistSession = !!memoryToken;
      return;
    }

    if (hasElectronSessionBridge()) {
      const electronSession = await readFromElectronStore();
      if (electronSession.token && electronSession.persist) {
        memoryToken = electronSession.token;
        persistSession = true;
        writeWebToken(electronSession.token, true);
        return;
      }
    }

    persistSession = readPersistFlag();
    memoryToken = readWebToken();
  })();
  return initPromise;
}

export function getSessionToken(): string | null {
  if (memoryToken !== undefined) return memoryToken;
  if (typeof window === "undefined") return null;
  if (!isMobileNative()) {
    return readWebToken();
  }
  return null;
}

export function setSessionToken(token: string, options?: { persist?: boolean }): void {
  const persist = options?.persist ?? true;
  memoryToken = token;
  persistSession = persist;

  if (typeof window === "undefined") return;

  if (isMobileNative()) {
    void writeToSecureStorage(token);
    return;
  }

  if (persist) {
    writeWebToken(token, true);
    void writeToElectronStore(token, true);
    return;
  }

  writeWebToken(token, false);
  void writeToElectronStore(null, false);
}

export function clearSessionToken(): void {
  memoryToken = null;
  persistSession = false;

  if (typeof window === "undefined") return;

  if (isMobileNative()) {
    void removeFromSecureStorage();
    return;
  }

  clearWebToken();
  void writeToElectronStore(null, false);
}

export function isPersistedSession(): boolean {
  return persistSession;
}

export function hasStoredSessionToken(): boolean {
  return !!getSessionToken();
}
