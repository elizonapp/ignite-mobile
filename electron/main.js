import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  session,
  Tray,
} from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { startDistServer, PACKAGED_DIST_PORT } from "./static-server.js";
import { initAutoUpdater, isAutoUpdateSupported, runUpdateCheck } from "./updater.js";
import { clearSession, readSession, writeSession } from "./session-store.cjs";
import { desktopPush } from "./desktop-push.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.setAppUserModelId("app.elizon.ignite.desktop");
app.name = "elizon";

const distDir = path.join(__dirname, "..", "dist");
const appIconPath = path.join(__dirname, "..", "build", "icon.png");
const appIcon = nativeImage.createFromPath(appIconPath);
const devUrl =
  process.env.ELECTRON_DEV_URL ||
  process.env.START_URL ||
  (process.env.PORT ? `http://localhost:${process.env.PORT}` : undefined);

/** @type {{ close?: () => Promise<void> } | null} */
let distServer = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let isQuitting = false;

async function resolveAppUrl() {
  if (!app.isPackaged && devUrl) {
    return devUrl;
  }
  distServer = await startDistServer(distDir, {
    port: app.isPackaged ? PACKAGED_DIST_PORT : 0,
  });
  return `${distServer.url}/index.html`;
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow();
    return mainWindow;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  return mainWindow;
}

function sendToRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function createTray() {
  if (tray) return tray;
  let icon = appIcon;
  if (icon.isEmpty()) {
    icon = nativeImage.createFromPath(appIconPath);
  }
  if (!icon.isEmpty()) {
    try {
      icon = icon.resize({ width: 16, height: 16 });
    } catch {
      // keep original size
    }
  }
  tray = new Tray(icon);
  tray.setToolTip("elizon");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Öffnen",
        click: () => {
          showMainWindow();
        },
      },
      { type: "separator" },
      {
        label: "Beenden",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", () => {
    showMainWindow();
  });
  tray.on("click", () => {
    if (process.platform === "win32") showMainWindow();
  });
  return tray;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "elizon",
    icon: appIcon.isEmpty() ? undefined : appIcon,
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      partition: "persist:elizon",
    },
  });

  win.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
    if (process.platform === "darwin" && app.dock) {
      app.dock.hide();
    }
  });

  void resolveAppUrl()
    .then((url) => win.loadURL(url))
    .catch((err) => {
      console.error("Failed to load app URL:", err);
    });

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  if (app.isPackaged && isAutoUpdateSupported()) {
    initAutoUpdater(win, (payload) => {
      if (!win.isDestroyed()) {
        win.webContents.send("updater:status", payload);
      }
    });
  }

  mainWindow = win;
  return win;
}

function wireDesktopPush() {
  desktopPush.onToken = (token) => {
    sendToRenderer("push:token", { token });
  };

  desktopPush.onNotificationClick = (payload) => {
    const win = showMainWindow();
    if (process.platform === "darwin" && app.dock) {
      app.dock.show();
    }
    if (win && !win.isDestroyed()) {
      win.webContents.send("push:notification-click", {
        serviceId: payload.serviceId,
        data: payload.data || {},
      });
    }
  };

  ipcMain.handle("push:enable", async (_event, payload) => {
    const authToken =
      payload && typeof payload === "object" && typeof payload.authToken === "string"
        ? payload.authToken
        : undefined;
    const result = await desktopPush.enable({ authToken });
    return result;
  });

  ipcMain.handle("push:disable", async () => {
    await desktopPush.disable({ clearCredentials: false });
    return { ok: true };
  });

  ipcMain.handle("push:getToken", () => ({
    token: desktopPush.getToken(),
  }));

  ipcMain.handle("push:isSupported", () => ({
    supported: desktopPush.isSupported(),
    notifications: Notification.isSupported(),
  }));

  ipcMain.handle("push:setAuthToken", (_event, token) => {
    desktopPush.setAuthToken(typeof token === "string" ? token : null);
    return { ok: true };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createTray();

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === "notifications") {
      callback(true);
      return;
    }
    callback(false);
  });

  ipcMain.handle("updater:check", async () => {
    if (!app.isPackaged || !isAutoUpdateSupported()) {
      return { ok: false, phase: "unsupported" };
    }
    return runUpdateCheck(true);
  });

  ipcMain.handle("session:get", () => readSession());

  ipcMain.handle("session:set", (_event, token, persist) => {
    if (typeof token !== "string" || !token.trim()) {
      clearSession();
      return { ok: true };
    }
    writeSession(token.trim(), persist !== false);
    return { ok: true };
  });

  ipcMain.handle("session:clear", () => {
    clearSession();
    return { ok: true };
  });

  wireDesktopPush();
  createWindow();
});

// Keep process alive when windows are hidden (tray).
app.on("window-all-closed", () => {
  // no-op: tray keeps the app running on all platforms
});

app.on("activate", () => {
  if (process.platform === "darwin" && app.dock) {
    app.dock.show();
  }
  showMainWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  void desktopPush.disable({ clearCredentials: false });
  if (tray) {
    tray.destroy();
    tray = null;
  }
  void distServer?.close?.();
});
