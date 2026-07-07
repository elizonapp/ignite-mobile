import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  openWindow: (url) => ipcRenderer.send("open-window", url),
  openExternal: (url) => ipcRenderer.send("open-external", url),
});
