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
	claude: {
		isSetup: () => ipcRenderer.invoke('claude:isSetup'),
		setup: () => ipcRenderer.invoke('claude:setup'),
		testIntegration: () => ipcRenderer.invoke('claude:testIntegration'),
		getUsage: () => ipcRenderer.invoke('claude:getUsage'),
		getSource: () => ipcRenderer.invoke('claude:getSource'),
		getAccountEmail: () => ipcRenderer.invoke('claude:getAccountEmail'),
		onState: (cb: (state: string) => void) => ipcRenderer.on('claude:state', (_, s) => cb(s)),
		onUsage: (cb: (u: unknown) => void) =>
			ipcRenderer.on('claude:usage', (_, u) => cb(u)),
		onSource: (cb: (source: string) => void) => ipcRenderer.on('claude:source', (_, s) => cb(s)),
	},
	antigravity: {
		getStatus: () => ipcRenderer.invoke('antigravity:getStatus'),
		onStatus: (cb: (status: unknown) => void) => ipcRenderer.on('antigravity:status', (_, status) => cb(status)),
	},
	pomodoroPresets: crudApi('pomodoroPresets'),
	pomodoroSettings: valueApi('pomodoroSettings'),
	pomodoroStats: valueApi('pomodoroStats'),
	wifi: {
		scan: () => ipcRenderer.invoke('wifi:scan'),
		connect: (ssid: string, password: string) => ipcRenderer.invoke('wifi:connect', ssid, password),
		status: () => ipcRenderer.invoke('wifi:status'),
		forget: () => ipcRenderer.invoke('wifi:forget'),
		sendNotify: (title: string, message: string) => ipcRenderer.invoke('wifi:sendNotify', title, message),
	},
});
