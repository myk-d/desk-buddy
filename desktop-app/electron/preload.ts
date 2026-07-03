import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
	sendPacket: (packet: string) => ipcRenderer.send('serial:send', packet),
	onStatusChange: (callback: (status: string, path?: string) => void) => {
		ipcRenderer.on('serial:status', (_, status, path) => callback(status, path));
	},
	onData: (callback: (data: string) => void) => {
		ipcRenderer.on('serial:data', (_, data) => callback(data));
	},
});
