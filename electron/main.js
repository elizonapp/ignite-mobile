import { app, BrowserWindow, nativeImage } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { startDistServer } from "./static-server.js";

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
  distServer = await startDistServer(distDir);
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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
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

  return win;
}

app.whenReady().then(() => {
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
