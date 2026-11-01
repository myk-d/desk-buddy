export type Screen = 'scanning' | 'success' | 'welcome' | 'dashboard';
export type Page = 'dashboard' | 'pomodoro' | 'device';

export interface ClaudeUsage {
	hasData: boolean;
	fiveHourPct: number | null;
	fiveHourResetsAt: number | null;
	sevenDayPct: number | null;
	sevenDayResetsAt: number | null;
}

// ── Antigravity (Google's agentic IDE) ──────────────────────────────────────
// Read from its local language server — unofficial/undocumented, see
// electron/antigravity.ts for the full explanation and caveats.

export interface AntigravityModelQuota {
	modelId: string;
	label: string;
	remainingFraction: number; // 0–1
	resetAt: number | null; // epoch ms
	isExhausted: boolean;
}

export interface AntigravityPromptCredits {
	used: number;
	limit: number;
	remaining: number;
}

export interface AntigravityStatus {
	connected: boolean;
	email: string | null;
	tierName: string | null;
	promptCredits: AntigravityPromptCredits | null;
	models: AntigravityModelQuota[];
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
			claude: {
				isSetup: () => Promise<boolean>;
				setup: () => Promise<boolean>;
				testIntegration: () => Promise<{ ok: boolean; hooksConfigured: boolean; message: string }>;
				getUsage: () => Promise<ClaudeUsage>;
				getSource: () => Promise<string | null>;
				getAccountEmail: () => Promise<string | null>;
				onState: (cb: (state: string) => void) => void;
				onUsage: (cb: (u: ClaudeUsage) => void) => void;
				onSource: (cb: (source: string) => void) => void;
			};
			antigravity: {
				getStatus: () => Promise<AntigravityStatus>;
				onStatus: (cb: (status: AntigravityStatus) => void) => void;
			};
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
