import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("api", {
  sendPacket: (packet) => ipcRenderer.send("serial:send", packet),
  onStatusChange: (callback) => {
    ipcRenderer.on("serial:status", (_, status, path) => callback(status, path));
  },
  onData: (callback) => {
    ipcRenderer.on("serial:data", (_, data) => callback(data));
  },
  onModeChange: (callback) => {
    ipcRenderer.on("tracker:mode", (_, mode) => callback(mode));
  }
});
