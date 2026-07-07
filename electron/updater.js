import { dialog, shell } from "electron";
import { autoUpdater } from "electron-updater";

const RELEASE_URL = "https://github.com/elizonapp/ignite-mobile/releases/latest";

/** @typedef {'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'} UpdaterPhase */

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;

/** @type {boolean} */
let manualCheck = false;

/** @type {boolean} */
let updateAvailableHandled = false;

/** @type {(payload: Record<string, unknown>) => void} */
let notifyRenderer = () => {};

/**
 * @param {import('electron').BrowserWindow | null} win
 * @param {(payload: Record<string, unknown>) => void} onStatus
 */
export function initAutoUpdater(win, onStatus) {
  mainWindow = win;
  notifyRenderer = onStatus;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on("checking-for-update", () => {
    notifyRenderer({ phase: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    notifyRenderer({ phase: "available", version: info.version });
    if (updateAvailableHandled) return;
    updateAvailableHandled = true;
    if (process.platform === "darwin") {
      void promptMacUpdate(info.version);
      return;
    }
    void promptDownload(info.version);
  });

  autoUpdater.on("update-not-available", (info) => {
    notifyRenderer({ phase: "not-available", version: info?.version ?? null });
    if (manualCheck) {
      manualCheck = false;
      void showDialog({
        type: "info",
        title: "Kein Update verfügbar",
        message: "Sie verwenden bereits die neueste Version.",
      });
    }
  });

  autoUpdater.on("download-progress", (progress) => {
    notifyRenderer({
      phase: "downloading",
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    notifyRenderer({ phase: "downloaded", version: info.version });
    void promptInstall(info.version);
  });

  autoUpdater.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    notifyRenderer({ phase: "error", message });
    if (manualCheck) {
      manualCheck = false;
      void showDialog({
        type: "error",
        title: "Update fehlgeschlagen",
        message: "Die Update-Prüfung ist fehlgeschlagen.",
        detail: message,
      });
    }
  });

  setTimeout(() => {
    void runUpdateCheck(false);
  }, 5000);
}

/**
 * @param {boolean} fromUser
 * @returns {Promise<{ ok: boolean; phase?: string; version?: string; message?: string }>}
 */
export async function runUpdateCheck(fromUser) {
  manualCheck = fromUser;
  updateAvailableHandled = false;

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true, phase: "checking" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notifyRenderer({ phase: "error", message });
    if (fromUser) {
      manualCheck = false;
    }
    return { ok: false, phase: "error", message };
  }
}

/**
 * @param {string} version
 */
async function promptMacUpdate(version) {
  const { response } = await showDialog({
    type: "info",
    title: "Update verfügbar",
    message: `Version ${version} ist verfügbar.`,
    detail:
      "Laden Sie das DMG von GitHub herunter und ersetzen Sie elizon im Programme-Ordner.",
    buttons: ["Release öffnen", "Später"],
    defaultId: 0,
    cancelId: 1,
  });

  manualCheck = false;

  if (response === 0) {
    await shell.openExternal(RELEASE_URL);
  }
}

/**
 * @param {string} version
 */
async function promptDownload(version) {
  const { response } = await showDialog({
    type: "info",
    title: "Update verfügbar",
    message: `Version ${version} ist verfügbar.`,
    detail: "Möchten Sie das Update jetzt herunterladen?",
    buttons: ["Herunterladen", "Später"],
    defaultId: 0,
    cancelId: 1,
  });

  manualCheck = false;

  if (response === 0) {
    notifyRenderer({ phase: "downloading", percent: 0 });
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notifyRenderer({ phase: "error", message });
      await showDialog({
        type: "error",
        title: "Download fehlgeschlagen",
        message: "Das Update konnte nicht heruntergeladen werden.",
        detail: message,
      });
    }
  }
}

/**
 * @param {string} version
 */
async function promptInstall(version) {
  const { response } = await showDialog({
    type: "info",
    title: "Update bereit",
    message: `Version ${version} wurde heruntergeladen.`,
    detail: "elizon wird neu gestartet, um die Installation abzuschließen.",
    buttons: ["Jetzt neu starten", "Später"],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    autoUpdater.quitAndInstall(false, true);
  }
}

/**
 * @param {Electron.MessageBoxOptions} options
 */
async function showDialog(options) {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  return dialog.showMessageBox(win, options);
}

/** @returns {boolean} */
export function isAutoUpdateSupported() {
  if (process.platform === "win32" && process.env.PORTABLE_EXECUTABLE_DIR) {
    return false;
  }
  return true;
}
