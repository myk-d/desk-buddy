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
