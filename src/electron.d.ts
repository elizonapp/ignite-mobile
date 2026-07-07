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

declare global {
  interface Window {
    electron?: {
      platform?: string;
      checkForUpdates?: () => Promise<UpdaterCheckResult>;
      onUpdaterStatus?: (callback: (status: UpdaterStatus) => void) => () => void;
    };
  }
}
