import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("api", {
  sendPacket: (packet) => ipcRenderer.send("serial:send", packet),
  setPomodoroActive: (active) => ipcRenderer.send("pomodoro:setActive", active),
  onStatusChange: (callback) => {
    ipcRenderer.on("serial:status", (_, status, path) => callback(status, path));
  },
  onData: (callback) => {
    ipcRenderer.on("serial:data", (_, data) => callback(data));
  },
  onModeChange: (callback) => {
    ipcRenderer.on("tracker:mode", (_, mode) => callback(mode));
  },
  onUpdateReady: (callback) => {
    ipcRenderer.on("update:ready", () => callback());
  },
  installUpdate: () => ipcRenderer.send("update:install"),
  firmware: {
    getDeviceVersion: () => ipcRenderer.invoke("firmware:getDeviceVersion"),
    checkUpdate: () => ipcRenderer.invoke("firmware:checkUpdate"),
    flash: () => ipcRenderer.invoke("firmware:flash"),
    onProgress: (cb) => ipcRenderer.on("firmware:progress", (_, pct, status) => cb(pct, status)),
    onError: (cb) => ipcRenderer.on("firmware:error", (_, msg) => cb(msg))
  },
  todos: {
    list: () => ipcRenderer.invoke("todos:list"),
    create: (data) => ipcRenderer.invoke("todos:create", data),
    update: (id, patch) => ipcRenderer.invoke("todos:update", id, patch),
    remove: (id) => ipcRenderer.invoke("todos:remove", id)
  },
  pomodoros: {
    list: () => ipcRenderer.invoke("pomodoros:list"),
    create: (data) => ipcRenderer.invoke("pomodoros:create", data),
    update: (id, patch) => ipcRenderer.invoke("pomodoros:update", id, patch),
    remove: (id) => ipcRenderer.invoke("pomodoros:remove", id)
  }
});
