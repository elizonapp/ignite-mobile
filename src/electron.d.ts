export {};

type UpdaterPhase =
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error"
  | "unsupported";

type UpdaterStatus = {
  phase: UpdaterPhase;
  version?: string;
  percent?: number;
  message?: string;
};

type UpdaterCheckResult = {
  ok: boolean;
  phase?: UpdaterPhase | "checking";
  version?: string;
  message?: string;
};

type ElectronStoredSession = {
  token: string | null;
  persist: boolean;
};

type ElectronPushEnableResult = {
  ok: boolean;
  token?: string | null;
  error?: string;
};

type ElectronPushTokenPayload = {
  token: string;
};

type ElectronPushClickPayload = {
  serviceId?: string;
  data?: Record<string, unknown>;
};

declare global {
  interface Window {
    electron?: {
      platform?: string;
      checkForUpdates?: () => Promise<UpdaterCheckResult>;
      onUpdaterStatus?: (callback: (status: UpdaterStatus) => void) => () => void;
      session?: {
        get: () => Promise<ElectronStoredSession>;
        set: (token: string, persist?: boolean) => Promise<{ ok: boolean }>;
        clear: () => Promise<{ ok: boolean }>;
      };
      push?: {
        enable: (payload?: { authToken?: string | null }) => Promise<ElectronPushEnableResult>;
        disable: () => Promise<{ ok: boolean }>;
        getToken: () => Promise<{ token: string | null }>;
        isSupported: () => Promise<{ supported: boolean; notifications: boolean }>;
        setAuthToken: (token: string | null) => Promise<{ ok: boolean }>;
        onToken: (callback: (payload: ElectronPushTokenPayload) => void) => () => void;
        onNotificationClick: (callback: (payload: ElectronPushClickPayload) => void) => () => void;
      };
    };
  }
}
