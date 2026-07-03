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
