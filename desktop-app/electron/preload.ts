import { contextBridge, ipcRenderer } from 'electron';

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
	firmware: {
		getDeviceVersion: () => ipcRenderer.invoke('firmware:getDeviceVersion'),
		checkUpdate: () => ipcRenderer.invoke('firmware:checkUpdate'),
		flash: () => ipcRenderer.invoke('firmware:flash'),
		onProgress: (cb: (pct: number, status: string) => void) =>
			ipcRenderer.on('firmware:progress', (_, pct, status) => cb(pct, status)),
		onError: (cb: (msg: string) => void) =>
			ipcRenderer.on('firmware:error', (_, msg) => cb(msg)),
	},
	todos: {
		list: () => ipcRenderer.invoke('todos:list'),
		create: (data: unknown) => ipcRenderer.invoke('todos:create', data),
		update: (id: string, patch: unknown) => ipcRenderer.invoke('todos:update', id, patch),
		remove: (id: string) => ipcRenderer.invoke('todos:remove', id),
	},
	pomodoros: {
		list: () => ipcRenderer.invoke('pomodoros:list'),
		create: (data: unknown) => ipcRenderer.invoke('pomodoros:create', data),
		update: (id: string, patch: unknown) => ipcRenderer.invoke('pomodoros:update', id, patch),
		remove: (id: string) => ipcRenderer.invoke('pomodoros:remove', id),
	},
});
