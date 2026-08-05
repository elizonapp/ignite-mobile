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
  push: {
    enable: (payload) => ipcRenderer.invoke("push:enable", payload),
    disable: () => ipcRenderer.invoke("push:disable"),
    getToken: () => ipcRenderer.invoke("push:getToken"),
    isSupported: () => ipcRenderer.invoke("push:isSupported"),
    setAuthToken: (token) => ipcRenderer.invoke("push:setAuthToken", token),
    onToken: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("push:token", handler);
      return () => ipcRenderer.removeListener("push:token", handler);
    },
    onNotificationClick: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("push:notification-click", handler);
      return () => ipcRenderer.removeListener("push:notification-click", handler);
    },
  },
});
