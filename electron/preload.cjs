const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  onUpdaterStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("updater:status", handler);
    return () => ipcRenderer.removeListener("updater:status", handler);
  },
  session: {
    get: () => ipcRenderer.invoke("session:get"),
    set: (token, persist) => ipcRenderer.invoke("session:set", token, persist),
    clear: () => ipcRenderer.invoke("session:clear"),
  },
});
