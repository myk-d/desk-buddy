import { contextBridge, ipcRenderer } from 'electron';

// Matches `registerCrudIpc`/`registerValueIpc` in electron/main.ts.
function crudApi(namespace: string) {
	return {
		list: () => ipcRenderer.invoke(`${namespace}:list`),
		create: (data: unknown) => ipcRenderer.invoke(`${namespace}:create`, data),
		update: (id: string, patch: unknown) => ipcRenderer.invoke(`${namespace}:update`, id, patch),
		remove: (id: string) => ipcRenderer.invoke(`${namespace}:remove`, id),
	};
}

function valueApi(namespace: string) {
	return {
		get: () => ipcRenderer.invoke(`${namespace}:get`),
		set: (value: unknown) => ipcRenderer.invoke(`${namespace}:set`, value),
	};
}

contextBridge.exposeInMainWorld('api', {
	sendPacket: (packet: string) => ipcRenderer.send('serial:send', packet),
	setPomodoroActive: (active: boolean) => ipcRenderer.send('pomodoro:setActive', active),
	onStatusChange: (callback: (status: string, path?: string) => void) => {
		ipcRenderer.on('serial:status', (_, status, path) => callback(status, path));
	},
	onData: (callback: (data: string) => void) => {
		ipcRenderer.on('serial:data', (_, data) => callback(data));
	},
	onModeChange: (callback: (mode: string) => void) => {
		ipcRenderer.on('tracker:mode', (_, mode) => callback(mode));
	},
	onUpdateReady: (callback: () => void) => {
		ipcRenderer.on('update:ready', () => callback());
	},
	installUpdate: () => ipcRenderer.send('update:install'),
	claude: {
		isSetup: () => ipcRenderer.invoke('claude:isSetup'),
		setup: () => ipcRenderer.invoke('claude:setup'),
		getUsage: () => ipcRenderer.invoke('claude:getUsage'),
		getSource: () => ipcRenderer.invoke('claude:getSource'),
		onState: (cb: (state: string) => void) => ipcRenderer.on('claude:state', (_, s) => cb(s)),
		onUsage: (cb: (u: unknown) => void) =>
			ipcRenderer.on('claude:usage', (_, u) => cb(u)),
		onSource: (cb: (source: string) => void) => ipcRenderer.on('claude:source', (_, s) => cb(s)),
	},
	firmware: {
		getDeviceVersion: () => ipcRenderer.invoke('firmware:getDeviceVersion'),
		checkUpdate: () => ipcRenderer.invoke('firmware:checkUpdate'),
		flash: () => ipcRenderer.invoke('firmware:flash'),
		onProgress: (cb: (pct: number, status: string) => void) =>
			ipcRenderer.on('firmware:progress', (_, pct, status) => cb(pct, status)),
		onError: (cb: (msg: string) => void) =>
			ipcRenderer.on('firmware:error', (_, msg) => cb(msg)),
		onVersion: (cb: (version: string | null) => void) =>
			ipcRenderer.on('firmware:version', (_, version) => cb(version)),
	},
	lists: crudApi('lists'),
	sections: crudApi('sections'),
	tasks: crudApi('tasks'),
	tags: crudApi('tags'),
	events: crudApi('events'),
	pomodoroPresets: crudApi('pomodoroPresets'),
	pomodoroSettings: valueApi('pomodoroSettings'),
	pomodoroStats: valueApi('pomodoroStats'),
	wifi: {
		scan: () => ipcRenderer.invoke('wifi:scan'),
		connect: (ssid: string, password: string) => ipcRenderer.invoke('wifi:connect', ssid, password),
		status: () => ipcRenderer.invoke('wifi:status'),
		forget: () => ipcRenderer.invoke('wifi:forget'),
	},
});
