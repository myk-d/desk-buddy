export type Screen = 'scanning' | 'success' | 'dashboard';
export type Page = 'dashboard' | 'pomodoro';

declare global {
	interface Window {
		api: {
			sendPacket: (packet: string) => void;
			onStatusChange: (callback: (status: string, path?: string) => void) => void;
			onData: (callback: (data: string) => void) => void;
			onModeChange: (callback: (mode: string) => void) => void;
		};
	}
}
