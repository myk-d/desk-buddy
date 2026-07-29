import { contextBridge, ipcRenderer } from "electron";
function crudApi(namespace) {
  return {
    list: () => ipcRenderer.invoke(`${namespace}:list`),
    create: (data) => ipcRenderer.invoke(`${namespace}:create`, data),
    update: (id, patch) => ipcRenderer.invoke(`${namespace}:update`, id, patch),
    remove: (id) => ipcRenderer.invoke(`${namespace}:remove`, id)
  };
}
function valueApi(namespace) {
  return {
    get: () => ipcRenderer.invoke(`${namespace}:get`),
    set: (value) => ipcRenderer.invoke(`${namespace}:set`, value)
  };
}
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
  claude: {
    isSetup: () => ipcRenderer.invoke("claude:isSetup"),
    setup: () => ipcRenderer.invoke("claude:setup"),
    getUsage: () => ipcRenderer.invoke("claude:getUsage"),
    getSource: () => ipcRenderer.invoke("claude:getSource"),
    onState: (cb) => ipcRenderer.on("claude:state", (_, s) => cb(s)),
    onUsage: (cb) => ipcRenderer.on("claude:usage", (_, u) => cb(u)),
    onSource: (cb) => ipcRenderer.on("claude:source", (_, s) => cb(s))
  },
  firmware: {
    getDeviceVersion: () => ipcRenderer.invoke("firmware:getDeviceVersion"),
    checkUpdate: () => ipcRenderer.invoke("firmware:checkUpdate"),
    flash: () => ipcRenderer.invoke("firmware:flash"),
    onProgress: (cb) => ipcRenderer.on("firmware:progress", (_, pct, status) => cb(pct, status)),
    onError: (cb) => ipcRenderer.on("firmware:error", (_, msg) => cb(msg)),
    onVersion: (cb) => ipcRenderer.on("firmware:version", (_, version) => cb(version))
  },
  lists: crudApi("lists"),
  sections: crudApi("sections"),
  tasks: crudApi("tasks"),
  tags: crudApi("tags"),
  events: crudApi("events"),
  pomodoroPresets: crudApi("pomodoroPresets"),
  pomodoroSettings: valueApi("pomodoroSettings"),
  pomodoroStats: valueApi("pomodoroStats"),
  wifi: {
    scan: () => ipcRenderer.invoke("wifi:scan"),
    connect: (ssid, password) => ipcRenderer.invoke("wifi:connect", ssid, password),
    status: () => ipcRenderer.invoke("wifi:status"),
    forget: () => ipcRenderer.invoke("wifi:forget")
  }
});
