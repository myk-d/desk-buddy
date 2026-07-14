export type Screen = 'scanning' | 'success' | 'dashboard';
export type Page = 'dashboard' | 'todo' | 'pomodoro' | 'device';

export interface Todo {
	id: string;
	title: string;
	description?: string;
	completed: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface PomodoroPreset {
	id: string;
	name: string;
	workMin: number;
	breakMin: number;
	sessions: number;
	linkedTaskId?: string | null;
	createdAt: number;
	updatedAt: number;
}

declare global {
	interface Window {
		api: {
			sendPacket: (packet: string) => void;
			setPomodoroActive: (active: boolean) => void;
			onStatusChange: (callback: (status: string, path?: string) => void) => void;
			onData: (callback: (data: string) => void) => void;
			onModeChange: (callback: (mode: string) => void) => void;
			onUpdateReady: (callback: () => void) => void;
			installUpdate: () => void;
			firmware: {
				getDeviceVersion: () => Promise<string | null>;
				checkUpdate: () => Promise<{ version: string; firmwareUrl: string } | null>;
				flash: () => Promise<string>;
				onProgress: (cb: (pct: number, status: string) => void) => void;
				onError: (cb: (msg: string) => void) => void;
			};
			todos: {
				list: () => Promise<Todo[]>;
				create: (data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Todo>;
				update: (id: string, patch: Partial<Omit<Todo, 'id' | 'createdAt'>>) => Promise<Todo | null>;
				remove: (id: string) => Promise<void>;
			};
			pomodoros: {
				list: () => Promise<PomodoroPreset[]>;
				create: (data: Omit<PomodoroPreset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PomodoroPreset>;
				update: (id: string, patch: Partial<Omit<PomodoroPreset, 'id' | 'createdAt'>>) => Promise<PomodoroPreset | null>;
				remove: (id: string) => Promise<void>;
			};
		};
	}
}
