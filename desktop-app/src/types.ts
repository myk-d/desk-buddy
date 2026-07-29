export type Screen = 'scanning' | 'success' | 'welcome' | 'dashboard';
export type Page = 'dashboard' | 'tasks' | 'calendar' | 'pomodoro' | 'device';

export interface ClaudeUsage {
	hasData: boolean;
	fiveHourPct: number | null;
	fiveHourResetsAt: number | null;
	sevenDayPct: number | null;
	sevenDayResetsAt: number | null;
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export type Priority = 'none' | 'low' | 'medium' | 'high';

export interface Subtask {
	id: string;
	text: string;
	completed: boolean;
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
	freq: RecurrenceFreq;
	interval: number;
	// dayjs .day() values (0=Sun..6=Sat); only meaningful when freq === 'weekly'.
	// null/empty means "same weekday as the anchor date".
	byWeekday: number[] | null;
	endDate: string | null;
	count: number | null;
}

export interface Task {
	id: string;
	sectionId: string;
	text: string;
	description: string;
	completed: boolean;
	pinned: boolean;
	priority: Priority;
	dueDate: string | null;
	recurrence: RecurrenceRule | null;
	// The due date at the moment recurrence was first turned on. Fixed forever
	// (unlike dueDate, which advances on each completion) so interval/weekday
	// math stays correct after several advances.
	recurrenceAnchorDate: string | null;
	// When true and there's at least one subtask, `completed` is kept in sync
	// with "every subtask is completed" on every subtask add/toggle/delete.
	autoCompleteWithSubtasks: boolean;
	tagIds: string[];
	subtasks: Subtask[];
	order: number;
	createdAt: number;
	updatedAt: number;
}

export type GroupBy = 'sequence' | 'date' | 'createdAt' | 'tag' | 'priority' | 'none';
export type SortBy = 'sequence' | 'date' | 'createdAt' | 'updatedAt' | 'name' | 'tag' | 'priority';

export type TagColor = 'rose' | 'amber' | 'emerald' | 'sky' | 'violet' | 'stone';

// Note: `updatedAt` is added on top of the source app's shape (which didn't
// need it under Firestore) because this app's `createJsonStore<T>` requires
// every stored entity to satisfy `{ id, createdAt, updatedAt }`.
export interface Tag {
	id: string;
	name: string;
	color: TagColor;
	createdAt: number;
	updatedAt: number;
}

export interface Section {
	id: string;
	listId: string;
	name: string;
	order: number;
	createdAt: number;
	updatedAt: number;
}

export interface TaskList {
	id: string;
	name: string;
	isDefault?: boolean;
	createdAt: number;
	updatedAt: number;
	groupBy: GroupBy;
	sortBy: SortBy;
}

// ── Calendar ─────────────────────────────────────────────────────────────────

export interface CalendarEvent {
	id: string;
	title: string;
	description: string;
	date: string;
	allDay: boolean;
	startTime: string;
	endTime: string;
	location: string;
	color: TagColor;
	reminderMinutes: number | null;
	recurrence: RecurrenceRule | null;
	// Dates (of this series) to skip when expanding recurrence — deleted or overridden occurrences.
	recurrenceExceptions: string[];
	// Set only on a standalone event that overrides one occurrence of a series;
	// null on normal events and on series masters.
	recurrenceMasterId: string | null;
	createdAt: number;
	updatedAt: number;
}

// ── Pomodoro ─────────────────────────────────────────────────────────────────

export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak';

export interface PomodoroSettings {
	focusMinutes: number;
	shortBreakMinutes: number;
	longBreakMinutes: number;
	sessionsBeforeLongBreak: number;
	autoStartNext: boolean;
}

export interface PomodoroPreset {
	id: string;
	name: string;
	focusMinutes: number;
	shortBreakMinutes: number;
	longBreakMinutes: number;
	sessionsBeforeLongBreak: number;
	autoStartNext: boolean;
	linkedTaskId?: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface PomodoroStats {
	todayDate: string;
	todaySessions: number;
	todayFocusMinutes: number;
	totalSessions: number;
	totalFocusMinutes: number;
}

// ── WiFi provisioning ────────────────────────────────────────────────────────
// Credentials go over the existing USB serial link, never typed on the
// device — once connected, the device hosts its own HTTP server so Claude
// Code hooks can reach it directly without this app running.

export interface WifiConfig {
	configured: boolean;
	ssid: string | null;
	token: string | null;
}

// Renderer-facing subset of WifiConfig — the token stays main-process-only.
export interface WifiStatus {
	configured: boolean;
	ssid: string | null;
}

export interface WifiNetwork {
	ssid: string;
	rssi: number;
}

export interface WifiConnectResult {
	connected: boolean;
	ip: string | null;
}

// Generic shape for a JSON-file-backed collection namespace exposed over IPC —
// matches the existing `createJsonStore<T>` contract (main-process
// `electron/store.ts`) that every entity collection below is built on.
interface CrudApi<T extends { id: string }> {
	list: () => Promise<T[]>;
	// `id` is supplied by the caller (client-generated) — see the comment on
	// `createJsonStore.create` in electron/store.ts for why.
	create: (data: Omit<T, 'createdAt' | 'updatedAt'>) => Promise<T>;
	update: (id: string, patch: Partial<Omit<T, 'id' | 'createdAt'>>) => Promise<T | null>;
	remove: (id: string) => Promise<void>;
}

// Generic shape for a single-value (singleton) JSON-file store — no per-item
// CRUD, just a whole-object get/set, backed by `createJsonValueStore<T>`.
interface ValueApi<T> {
	get: () => Promise<T>;
	set: (value: T) => Promise<void>;
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
			claude: {
				isSetup: () => Promise<boolean>;
				setup: () => Promise<boolean>;
				getUsage: () => Promise<ClaudeUsage>;
				getSource: () => Promise<string | null>;
				onState: (cb: (state: string) => void) => void;
				onUsage: (cb: (u: ClaudeUsage) => void) => void;
				onSource: (cb: (source: string) => void) => void;
			};
			firmware: {
				getDeviceVersion: () => Promise<string | null>;
				checkUpdate: () => Promise<{ version: string; firmwareUrl: string } | null>;
				flash: () => Promise<string>;
				onProgress: (cb: (pct: number, status: string) => void) => void;
				onError: (cb: (msg: string) => void) => void;
				onVersion: (cb: (version: string | null) => void) => void;
			};
			lists: CrudApi<TaskList>;
			sections: CrudApi<Section>;
			tasks: CrudApi<Task>;
			tags: CrudApi<Tag>;
			events: CrudApi<CalendarEvent>;
			pomodoroPresets: CrudApi<PomodoroPreset>;
			pomodoroSettings: ValueApi<PomodoroSettings>;
			pomodoroStats: ValueApi<PomodoroStats>;
			wifi: {
				scan: () => Promise<WifiNetwork[]>;
				connect: (ssid: string, password: string) => Promise<WifiConnectResult>;
				status: () => Promise<WifiStatus>;
				forget: () => Promise<void>;
				sendNotify: (title: string, message: string) => Promise<void>;
			};
		};
	}
}
