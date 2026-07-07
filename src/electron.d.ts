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
    };
  }
}
