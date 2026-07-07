import { app, BrowserWindow, ipcMain, Menu, nativeImage } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { startDistServer, PACKAGED_DIST_PORT } from "./static-server.js";
import { initAutoUpdater, isAutoUpdateSupported, runUpdateCheck } from "./updater.js";
import { clearSession, readSession, writeSession } from "./session-store.cjs";

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

async function resolveAppUrl() {
  if (!app.isPackaged && devUrl) {
    return devUrl;
  }
  distServer = await startDistServer(distDir, {
    port: app.isPackaged ? PACKAGED_DIST_PORT : 0,
  });
  return `${distServer.url}/index.html`;
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

  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

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

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("will-quit", () => {
  void distServer?.close?.();
});
