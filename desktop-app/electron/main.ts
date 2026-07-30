import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import { exec, execSync } from 'child_process';
import { randomUUID, randomBytes } from 'crypto';
import { dirname, join } from 'path';
import http from 'http';
import https from 'https';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { SerialPort } from 'serialport';
import { fileURLToPath } from 'url';
import electronUpdaterPkg from 'electron-updater';
const { autoUpdater } = electronUpdaterPkg;
import { triggerBootloaderReset, findEspPort, flashFirmware, otaFlash } from './flasher';
import { createJsonStore, createJsonValueStore } from './store';
import type { TaskList, Section, Task, Tag, CalendarEvent, PomodoroPreset, PomodoroSettings, PomodoroStats, WifiConfig, WifiNetwork, WifiConnectResult, WifiStatus } from '../src/types';

const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
	focusMinutes: 25,
	shortBreakMinutes: 5,
	longBreakMinutes: 15,
	sessionsBeforeLongBreak: 4,
	autoStartNext: true,
};

const DEFAULT_POMODORO_STATS: PomodoroStats = {
	todayDate: '',
	todaySessions: 0,
	todayFocusMinutes: 0,
	totalSessions: 0,
	totalFocusMinutes: 0,
};

const DEFAULT_WIFI_CONFIG: WifiConfig = { configured: false, ssid: null, token: null };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let activePort: SerialPort | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
// Closing the window normally just hides it (see createWindow's 'close'
// handler) so the Claude Code hook relay / serial connection / device
// tracker all keep running in the background — only the tray's "Quit" sets
// this and calls app.quit() for a real exit.
let isQuitting = false;
let autoConnectTimer: NodeJS.Timeout | null = null;
let windowTrackerTimer: NodeJS.Timeout | null = null;
let isConnecting = false;
let isDeviceConnected = false;
let lastCategory: Category | null = null;
let isPomodoroActive = false;
let isFlashing = false;
let deviceFirmwareVersion: string | null = null;

// The firmware sometimes writes a single logical line across two separate
// Serial.print()/println() calls with a real gap between them (e.g.
// "WIFI_NETWORKS:" printed immediately, the actual list only ~6s later once
// the blocking scan finishes) — a raw 'data' event can therefore contain only
// half a line. Buffered across events and only matched once a full line
// (terminated by \n) has arrived, so regexes never see truncated data.
let serialLineBuffer = '';

type ClaudeCodeState = 'idle' | 'working' | 'done' | 'waiting';
let claudeCodeState: ClaudeCodeState = 'idle';
let claudeResetTimer: NodeJS.Timeout | null = null;

// $CLAUDE_CODE_ENTRYPOINT from the hook that last fired — e.g. "cli" (a real
// terminal) or "claude-vscode" (the VS Code extension). Only the terminal
// front-end ever renders a statusLine, so this explains to the user why the
// usage bars might stay empty even while this state updates fine.
let claudeCodeSource: string | null = null;

interface ClaudeUsage {
	hasData: boolean;
	fiveHourPct: number | null;
	fiveHourResetsAt: number | null;
	sevenDayPct: number | null;
	sevenDayResetsAt: number | null;
}
let claudeUsage: ClaudeUsage = {
	hasData: false, fiveHourPct: null, fiveHourResetsAt: null, sevenDayPct: null, sevenDayResetsAt: null,
};

// Assigned once app.whenReady() runs (createJsonValueStore needs app.getPath,
// unavailable before then) — see currentHookTarget()'s `wifiStore?.get()`.
let wifiStore: ReturnType<typeof createJsonValueStore<WifiConfig>> | null = null;

interface PendingWifiRequest {
	resolve: (value: unknown) => void;
	reject: (err: Error) => void;
	timeout: NodeJS.Timeout;
}
let pendingWifiRequest: PendingWifiRequest | null = null;

// ── Claude Code hook scripts (written to ~/.claude/hooks/ on setup) ───────────
// Target is either the app's own localhost:7842 relay (default — requires the
// app running) or the device's own WiFi-hosted server (once configured —
// works even with the app closed). Regenerated whenever WiFi connects/forgets.

const CLAUDE_HOOKS_DIR = join(homedir(), '.claude', 'hooks');
const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

interface HookTarget {
	host: string;
	port: number;
	token: string | null;
}

function localHookTarget(): HookTarget {
	return { host: '127.0.0.1', port: 7842, token: null };
}

function currentHookTarget(): HookTarget {
	const wifi = wifiStore?.get() ?? DEFAULT_WIFI_CONFIG;
	if (wifi.configured && wifi.token) return { host: 'gaze-buddy.local', port: 80, token: wifi.token };
	return localHookTarget();
}

// Builds the hook's `command` string *directly* — no intermediate script
// file, no `bash`/`cmd /c`/`node` wrapper. Claude Code already runs this
// string through a shell itself (cmd.exe on Windows), so wrapping it in our
// own shell invocation creates a nested cmd.exe call — and nested cmd.exe
// quote-parsing is notoriously fragile; it silently mangled our hooks on a
// real Windows machine even though the wrapped .cmd file worked fine when
// run directly. Calling `curl` inline sidesteps that: only one shell layer
// exists, whatever Claude Code itself spawns, matching exactly what a
// manual test would run. curl itself has no missing-dependency risk either
// (bundled with Windows since 10 1803/11, part of the base OS on
// macOS/Linux) — unlike bash (needs WSL/Git Bash on Windows) or node (not
// guaranteed if Claude Code was installed as a standalone binary).
// $CLAUDE_CODE_ENTRYPOINT (e.g. "cli" / "claude-vscode") tells the app
// whether this fired from a terminal session or the VS Code extension —
// used to explain why usage bars (statusLine-only) might be empty despite
// this state hook firing fine from either front-end.
const IS_WINDOWS = process.platform === 'win32';

function buildStateHookCommand(target: HookTarget, state: string): string {
	const logPath = join(CLAUDE_HOOKS_DIR, 'hook.log');
	if (IS_WINDOWS) {
		const tokenHeader = target.token ? ` -H "X-Gaze-Token: ${target.token}"` : '';
		// `-S` keeps error text despite `-s` (silent normally swallows both).
		// Logging stays temporary, to confirm this actually fixes delivery.
		return `curl -sS -f -X POST http://${target.host}:${target.port}/claude-state -H "Content-Type: application/json"${tokenHeader} -d "{\\"state\\":\\"${state}\\",\\"source\\":\\"%CLAUDE_CODE_ENTRYPOINT%\\"}" >>"${logPath}" 2>&1`;
	}
	const tokenHeader = target.token ? ` -H 'X-Gaze-Token: ${target.token}'` : '';
	return `curl -sS -f -X POST http://${target.host}:${target.port}/claude-state -H 'Content-Type: application/json'${tokenHeader} -d "{\\"state\\":\\"${state}\\",\\"source\\":\\"\${CLAUDE_CODE_ENTRYPOINT:-unknown}\\"}" >>"${logPath}" 2>&1 || true`;
}

// Fed the real rate_limits (five_hour/seven_day used_percentage + resetsAt) by
// Claude Code on every statusLine render; POSTs them to the target server and
// still prints a normal status line so the terminal UI keeps working.
function buildStatuslineHook(target: HookTarget): string {
	const tokenHeader = target.token ? `'X-Gaze-Token': '${target.token}', ` : '';
	return `#!/usr/bin/env node
'use strict';
const http = require('http');

let raw = '';
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
    let data = {};
    try { data = JSON.parse(raw); } catch {}

    const model = data.model?.display_name ?? 'Claude';
    const rl = data.rate_limits;
    const fiveHour = rl?.five_hour;
    const sevenDay = rl?.seven_day;

    let line = model;
    if (fiveHour) line += \` | 5h: \${Math.round(fiveHour.used_percentage)}%\`;
    if (sevenDay) line += \` | 7d: \${Math.round(sevenDay.used_percentage)}%\`;
    process.stdout.write(line);

    if (rl) {
        // Two receivers, two contracts: the app's own localhost:7842 endpoint
        // does epoch-to-countdown math itself (has a real clock), so it wants
        // the raw resets_at epoch — but the device has no RTC and just
        // displays whatever duration it's given, so it needs secsLeft already
        // computed. Send both; each side reads only the field it understands.
        const now = Math.floor(Date.now() / 1000);
        const secsLeft = (resetsAt) => (typeof resetsAt === 'number' ? Math.max(0, Math.round(resetsAt - now)) : null);
        const payload = JSON.stringify({
            hasData: true,
            fiveHourPct: fiveHour?.used_percentage ?? null,
            fiveHourResetsAt: fiveHour?.resets_at ?? null,
            fiveHourSecsLeft: secsLeft(fiveHour?.resets_at),
            sevenDayPct: sevenDay?.used_percentage ?? null,
            sevenDayResetsAt: sevenDay?.resets_at ?? null,
            sevenDaySecsLeft: secsLeft(sevenDay?.resets_at),
        });
        const req = http.request({
            hostname: '${target.host}', port: ${target.port}, path: '/claude-usage', method: 'POST',
            headers: { ${tokenHeader}'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, () => { process.exit(0); });
        req.on('error', () => process.exit(0));
        req.setTimeout(300, () => { req.destroy(); process.exit(0); });
        req.write(payload);
        req.end();
    } else {
        process.exit(0);
    }
});
`;
}

function isClaudeHooksSetup(): boolean {
	try {
		const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf8'));
		const hooks = settings?.hooks ?? {};
		const hasHooks = !!(hooks.PreToolUse?.length && hooks.Stop?.length && hooks.Notification?.length);
		const hasStatusLine = settings?.statusLine?.type === 'command';
		return hasHooks && hasStatusLine;
	} catch {
		return false;
	}
}

function setupClaudeHooks(): void {
	mkdirSync(CLAUDE_HOOKS_DIR, { recursive: true });
	const target = currentHookTarget();
	writeFileSync(join(CLAUDE_HOOKS_DIR, 'statusline.js'), buildStatuslineHook(target), { mode: 0o755 });
	// Older formats from earlier iterations of this fix (bash, then node,
	// then a cmd-wrapped batch file) — remove so they don't linger as dead
	// files while debugging.
	for (const stale of ['pre-tool.sh', 'notification.sh', 'stop.sh', 'pre-tool.js', 'notification.js', 'stop.js', 'pre-tool.cmd', 'notification.cmd', 'stop.cmd']) {
		try { unlinkSync(join(CLAUDE_HOOKS_DIR, stale)); } catch {}
	}

	let settings: Record<string, unknown> = {};
	try { settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf8')); } catch {}

	settings.hooks = {
		...(settings.hooks as Record<string, unknown> ?? {}),
		// PreToolUse is matched per-tool, so it needs an explicit wildcard.
		// Stop/Notification aren't tool-specific — they take no `matcher` field at all.
		PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: buildStateHookCommand(target, 'working') }] }],
		Stop:        [{ hooks: [{ type: 'command', command: buildStateHookCommand(target, 'done') }] }],
		Notification:[{ hooks: [{ type: 'command', command: buildStateHookCommand(target, 'waiting') }] }],
	};
	settings.statusLine = { type: 'command', command: `node ${join(CLAUDE_HOOKS_DIR, 'statusline.js')}` };
	writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

const TARGET_VID = '303a';

type Category = 'focus' | 'relax' | 'idle';

// Names are compared lowercase after normalisation.
// Linux  → WM_CLASS instance (xprop)      e.g. "code", "webstorm"
// macOS  → frontmost process name (osascript)  e.g. "code", "webstorm"
// Windows → process name without .exe (powershell) e.g. "code", "idea64"
const FOCUS_APPS = new Set([
	// editors / IDEs
	'code', 'code - oss', 'code - insiders', 'vscodium', 'codium',
	'idea', 'idea64', 'intellij idea', 'intellij idea community edition',
	'webstorm', 'webstorm64',
	'pycharm', 'pycharm64', 'pycharm community edition',
	'clion', 'clion64', 'goland', 'goland64', 'rider', 'rider64',
	'sublime text', 'sublime_text', 'subl',
	'vim', 'gvim', 'nvim',
	'emacs', 'emacs-gtk',
	'gedit', 'kate', 'kwrite', 'mousepad', 'textmate',
	'xcode',           // macOS
	'devenv',          // Visual Studio (Windows)
	'notepad++',       // Windows
	'eclipse', 'android studio', 'arduino ide', 'arduino-ide',
	// terminals
	'gnome-terminal-server', 'konsole', 'xterm', 'alacritty', 'kitty', 'xfce4-terminal',
	'terminal', 'iterm2', 'iterm',           // macOS
	'windowsterminal', 'cmd', 'powershell', 'pwsh', // Windows
]);

const RELAX_APPS = new Set([
	// browsers
	'google-chrome', 'google-chrome-stable', 'google chrome', 'chrome',
	'firefox', 'firefox-esr',
	'microsoft-edge', 'microsoft edge', 'msedge',
	'safari',          // macOS
	'brave-browser', 'brave',
	'chromium', 'chromium-browser',
	'opera',
	// media
	'spotify', 'vlc',
	// chat / social
	'discord', 'slack', 'telegram', 'telegram desktop',
	'microsoft teams', 'teams',
	// games
	'steam',
]);

function classifyApp(appName: string | null): Category {
	if (!appName) return 'idle';
	if (FOCUS_APPS.has(appName)) return 'focus';
	if (RELAX_APPS.has(appName)) return 'relax';
	return 'idle';
}

const ANIM_PACKET: Record<Category, string> = {
	focus: '#ANIM:focus\n',
	relax: '#ANIM:relax\n',
	idle: '#ANIM:idle\n',
};

// Matches the mode labels already used by the manual buttons (see src/constants.ts ANIM_MODE_MAP).
const MODE_LABEL: Record<Category, string> = {
	focus: 'WORKING',
	relax: 'RELAX',
	idle: 'IDLE',
};

// Pre-encode the Windows PowerShell script as UTF-16LE base64 once at startup.
// -EncodedCommand avoids all shell-quoting issues with embedded strings.
const WIN_PS_ENCODED = process.platform === 'win32'
	? Buffer.from(
		`$code=@"
using System;
using System.Runtime.InteropServices;
public class WinFG {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
}
"@
Add-Type -TypeDefinition $code -Language CSharp -EA SilentlyContinue
$h=[WinFG]::GetForegroundWindow();$p=[uint32]0
[WinFG]::GetWindowThreadProcessId($h,[ref]$p)|Out-Null
try{(Get-Process -Id $p -EA Stop).ProcessName}catch{Write-Output ""}`,
		'utf16le',
	).toString('base64')
	: '';

async function getActiveWindowApp(): Promise<string | null> {
	try {
		if (process.platform === 'linux') {
			const winIdOut = execSync('xprop -root _NET_ACTIVE_WINDOW', { encoding: 'utf8', timeout: 800 });
			const winIdMatch = winIdOut.match(/0x[0-9a-f]+/i);
			// "0x0" is xprop's own way of saying "no window currently has focus"
			// (e.g. focus briefly on the desktop/a detached DevTools window) — it
			// matches the hex regex but xprop -id rejects it as an invalid id.
			if (!winIdMatch || winIdMatch[0] === '0x0') return null;
			const classOut = execSync(`xprop -id ${winIdMatch[0]} WM_CLASS`, { encoding: 'utf8', timeout: 800 });
			// WM_CLASS(STRING) = "code", "Code" — instance name is the first quoted token
			const classMatch = classOut.match(/"([^"]+)"/);
			return classMatch ? classMatch[1].toLowerCase() : null;
		}

		if (process.platform === 'darwin') {
			// osascript < 100 ms; safe to block
			const out = execSync(
				`osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`,
				{ encoding: 'utf8', timeout: 1500 },
			);
			return out.trim().toLowerCase() || null;
		}

		if (process.platform === 'win32') {
			// PowerShell startup ~300–500 ms; use async exec so the main process stays responsive
			return new Promise<string | null>((resolve) => {
				exec(
					`powershell -NoProfile -NonInteractive -EncodedCommand ${WIN_PS_ENCODED}`,
					{ timeout: 4000 },
					(err, stdout) => resolve(err ? null : stdout.trim().toLowerCase() || null),
				);
			});
		}

		return null;
	} catch {
		return null;
	}
}

// Thin relay: the app just forwards the raw signal over serial — the firmware
// itself decides what to draw (dedicated ST_CLAUDE screen, see main.cpp).
function handleClaudeCodeState(state: ClaudeCodeState) {
	if (claudeResetTimer) { clearTimeout(claudeResetTimer); claudeResetTimer = null; }

	claudeCodeState = state;
	mainWindow?.webContents.send('claude:state', state);

	if (!isDeviceConnected || !activePort?.isOpen) return;
	activePort.write(`#CLAUDE:${state}\n`);

	if (state === 'done') {
		claudeResetTimer = setTimeout(() => {
			claudeCodeState = 'idle';
			lastCategory = null;
			mainWindow?.webContents.send('claude:state', 'idle');
			if (isDeviceConnected && activePort?.isOpen) activePort.write('#CLAUDE:idle\n');
		}, 3000);
	}
}

function handleClaudeUsage(usage: Partial<ClaudeUsage>) {
	claudeUsage = { ...claudeUsage, ...usage, hasData: true };
	mainWindow?.webContents.send('claude:usage', { ...claudeUsage });

	if (claudeUsage.fiveHourPct === null || claudeUsage.sevenDayPct === null) return;

	// Firmware has no RTC, so it can't turn an epoch timestamp into a countdown —
	// the app computes seconds-remaining here (it has real wall-clock time) and
	// the device just displays it.
	const secsUntil = (resetsAt: number | null) =>
		resetsAt ? Math.max(0, Math.round(resetsAt - Date.now() / 1000)) : 0;
	const fiveHourSecsLeft = secsUntil(claudeUsage.fiveHourResetsAt);
	const sevenDaySecsLeft = secsUntil(claudeUsage.sevenDayResetsAt);

	// This is the account-usage-API poll's only path to the device — unlike
	// the state hooks, it runs from this app's own main process rather than
	// a Claude Code hook script, so it has no other route in. It used to
	// write over USB serial only, which silently did nothing on a WiFi-only
	// connection (state changes still worked, since hooks POST to
	// gaze-buddy.local directly, but usage bars never arrived). POST
	// directly when WiFi is configured, mirroring wifi:sendNotify below.
	const wifi = wifiStore?.get() ?? DEFAULT_WIFI_CONFIG;
	if (wifi.configured && wifi.token) {
		const payload = JSON.stringify({
			fiveHourPct: Math.round(claudeUsage.fiveHourPct),
			fiveHourSecsLeft,
			sevenDayPct: Math.round(claudeUsage.sevenDayPct),
			sevenDaySecsLeft,
		});
		const req = http.request({
			hostname: 'gaze-buddy.local', port: 80, path: '/claude-usage', method: 'POST',
			headers: { 'X-Gaze-Token': wifi.token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
		}, (res) => res.resume());
		req.on('error', () => {});
		req.setTimeout(3000, () => req.destroy());
		req.write(payload);
		req.end();
	}

	if (isDeviceConnected && activePort?.isOpen) {
		activePort.write(`#USAGE:${Math.round(claudeUsage.fiveHourPct)},${fiveHourSecsLeft},${Math.round(claudeUsage.sevenDayPct)},${sevenDaySecsLeft}\n`);
	}
}

// Fired when the device received a Claude Code update over WiFi directly
// (bypassing this app) and relayed it back over USB purely so this app's own
// UI stays in sync — must NOT write back to the device (it already knows;
// echoing would be circular).
function handleClaudeRelay(state: string) {
	if (state !== 'idle' && state !== 'working' && state !== 'done' && state !== 'waiting') return;
	claudeCodeState = state;
	mainWindow?.webContents.send('claude:state', state);
}

function handleClaudeUsageRelay(fiveHourPct: number, fiveHourSecsLeft: number, sevenDayPct: number, sevenDaySecsLeft: number) {
	const now = Math.round(Date.now() / 1000);
	claudeUsage = {
		hasData: true,
		fiveHourPct,
		fiveHourResetsAt: now + fiveHourSecsLeft,
		sevenDayPct,
		sevenDayResetsAt: now + sevenDaySecsLeft,
	};
	mainWindow?.webContents.send('claude:usage', { ...claudeUsage });
}

function startWindowTracker() {
	let isChecking = false;
	windowTrackerTimer = setInterval(async () => {
		if (!isDeviceConnected || !activePort?.isOpen || isChecking || isPomodoroActive || claudeCodeState !== 'idle') return;
		isChecking = true;
		try {
			const appName = await getActiveWindowApp();
			const category = classifyApp(appName);

			if (category === lastCategory) return;
			lastCategory = category;

			activePort!.write(ANIM_PACKET[category], (err) => {
				if (err) console.error('[window-tracker] write error:', err.message);
				else {
					console.log(`[window-tracker] → ${MODE_LABEL[category]} (app: ${appName ?? 'unknown'})`);
					mainWindow?.webContents.send('tracker:mode', MODE_LABEL[category]);
				}
			});
		} finally {
			isChecking = false;
		}
	}, 1500);
}

function createWindow(): void {
	mainWindow = new BrowserWindow({
		width: 900,
		height: 650,
		show: false,
		autoHideMenuBar: true,
		webPreferences: {
			preload: join(__dirname, 'preload.mjs'),
			sandbox: false,
		},
	});

	mainWindow.on('ready-to-show', () => {
		mainWindow?.show();
		startAutoConnectScanner();
		startWindowTracker();
		if (app.isPackaged) {
			autoUpdater.checkForUpdates().catch((err) =>
				console.warn('[updater] check failed:', err.message),
			);
		}
	});

	// Clicking the window's close button hides it instead of quitting the app —
	// the serial connection, device tracker, and the Claude Code hook HTTP
	// server all need to keep running so hooks fired while the window is
	// "closed" still reach the device instead of silently failing.
	mainWindow.on('close', (e) => {
		if (!isQuitting) {
			e.preventDefault();
			mainWindow?.hide();
		}
	});

	if (process.env['VITE_DEV_SERVER_URL']) {
		mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
		mainWindow.webContents.openDevTools({ mode: 'detach' });
	} else {
		mainWindow.loadFile(join(__dirname, '../dist/index.html'));
	}
}

function notifyDisconnected() {
	if (!isDeviceConnected) return;
	isDeviceConnected = false;
	lastCategory = null;
	deviceFirmwareVersion = null;
	mainWindow?.webContents.send('serial:status', 'disconnected');
}

function startAutoConnectScanner() {
	// Idempotent — the OTA flash path (firmware:flash) can reach the
	// finally-block call to this without ever having cleared a still-running
	// timer (USB teardown is skipped entirely when OTA succeeds), which would
	// otherwise leak a duplicate interval.
	if (autoConnectTimer) clearInterval(autoConnectTimer);
	autoConnectTimer = setInterval(async () => {
		if ((activePort && activePort.isOpen) || isConnecting || isFlashing) return;

		try {
			const ports = await SerialPort.list();
			const targetDevice = ports.find((p) => p.vendorId?.toLowerCase() === TARGET_VID);

			const espPorts = ports.filter((p) => p.vendorId?.toLowerCase() === TARGET_VID);
			if (espPorts.length > 1) {
				console.warn('[scanner] Знайдено декілька ESP32 портів:', espPorts.map((p) => `${p.path} (PID:${p.productId})`).join(', '));
			}

			if (targetDevice) {
				console.log(`[scanner] Підключаюсь до ${targetDevice.path} (PID:${targetDevice.productId})...`);

				isConnecting = true;
				activePort = new SerialPort({ path: targetDevice.path, baudRate: 115200 }, (err) => {
					isConnecting = false;
					if (err) {
						console.error('Помилка автопідключення:', err.message);
						activePort = null;
						return;
					}

					// Capture this specific instance so stale close events from a
					// previous connection can't null out a freshly opened port.
					const thisPort = activePort!;

					// Assert DTR so ESP32-S3 USB CDC recognises a connected host.
					// Without this, Serial.available() stays 0 on the firmware side.
					thisPort.set({ dtr: true }, (setErr) => {
						if (setErr) console.warn('[serial] DTR set error:', setErr.message);
					});

					isDeviceConnected = true;
					mainWindow?.webContents.send('serial:status', 'connected', targetDevice.path);

					thisPort.on('data', (data: Buffer) => {
						serialLineBuffer += data.toString();
						const lines = serialLineBuffer.split('\n');
						// Last element is either '' (buffer ended exactly on a newline) or
						// a not-yet-terminated partial line — either way, hold it back.
						serialLineBuffer = lines.pop() ?? '';

						for (const line of lines) {
							const str = line + '\n';
							const fwMatch = str.match(/FIRMWARE:([^\r\n]+)/);
							if (fwMatch) {
								deviceFirmwareVersion = fwMatch[1].trim();
								mainWindow?.webContents.send('firmware:version', deviceFirmwareVersion);
							}

							const networksMatch = str.match(/WIFI_NETWORKS:([^\r\n]*)/);
							if (networksMatch) {
								const networks: WifiNetwork[] = networksMatch[1]
									.split(';')
									.filter(Boolean)
									.map((entry) => {
										const [ssid, rssi] = entry.split(',');
										return { ssid, rssi: Number(rssi) };
									});
								resolvePendingWifi(networks);
							}

							const statusMatch = str.match(/WIFI_STATUS:([^\r\n]+)/);
							if (statusMatch) {
								const [state, ip] = statusMatch[1].split(',');
								if (state === 'failed') rejectPendingWifi(new Error('Could not connect to that network'));
								else resolvePendingWifi({ connected: state === 'connected', ip: ip ?? null });
							}

							const claudeRelayMatch = str.match(/CLAUDE_RELAY:([^\r\n]+)/);
							if (claudeRelayMatch) handleClaudeRelay(claudeRelayMatch[1].trim());

							const usageRelayMatch = str.match(/USAGE_RELAY:([^\r\n]+)/);
							if (usageRelayMatch) {
								const parts = usageRelayMatch[1].split(',').map(Number);
								if (parts.length === 4) handleClaudeUsageRelay(parts[0], parts[1], parts[2], parts[3]);
							}

							mainWindow?.webContents.send('serial:data', str);
						}
					});

					thisPort.on('close', () => {
						if (activePort === thisPort) activePort = null;
						notifyDisconnected();
					});

					thisPort.on('error', (portErr: Error) => {
						console.error('Serial port error:', portErr.message);
						if (activePort === thisPort) activePort = null;
						notifyDisconnected();
					});
				});
			} else {
				notifyDisconnected();
			}
		} catch (err) {
			console.error('Помилка сканера портів:', err);
		}
	}, 2000);
}

// ── Claude Code hook HTTP server ──────────────────────────────────────────────

http.createServer((req, res) => {
	if (req.method === 'POST' && req.url === '/claude-state') {
		let body = '';
		req.on('data', chunk => { body += chunk; });
		req.on('end', () => {
			try {
				const d = JSON.parse(body);
				handleClaudeCodeState(d.state);
				if (typeof d.source === 'string' && d.source !== claudeCodeSource) {
					claudeCodeSource = d.source;
					mainWindow?.webContents.send('claude:source', claudeCodeSource);
				}
			} catch {}
			res.writeHead(200);
			res.end('ok');
		});
	} else if (req.method === 'POST' && req.url === '/claude-usage') {
		let body = '';
		req.on('data', chunk => { body += chunk; });
		req.on('end', () => {
			try {
				const d = JSON.parse(body);
				handleClaudeUsage({
					fiveHourPct: d.fiveHourPct ?? null,
					fiveHourResetsAt: d.fiveHourResetsAt ?? null,
					sevenDayPct: d.sevenDayPct ?? null,
					sevenDayResetsAt: d.sevenDayResetsAt ?? null,
				});
			} catch {}
			res.writeHead(200);
			res.end('ok');
		});
	} else {
		res.writeHead(404);
		res.end();
	}
}).listen(7842, '127.0.0.1');

// ── Fallback usage source: Claude Code's own account-usage endpoint ──────────
// statusLine (the primary source above) never fires from the VS Code
// extension, only from a real terminal session. This polls the same
// undocumented endpoint Claude Code's own CLI uses, keyed off the OAuth token
// it already stores locally, so usage bars populate regardless of which
// front-end is active. Undocumented and known to self-rate-limit aggressively
// (429s even at ~5min polling), so we poll conservatively and back off hard.
const CLAUDE_CREDENTIALS_PATH = join(homedir(), '.claude', '.credentials.json');
let usageApiBackoffUntil = 0;

function readClaudeAccessToken(): string | null {
	try {
		const creds = JSON.parse(readFileSync(CLAUDE_CREDENTIALS_PATH, 'utf8'));
		return creds?.claudeAiOauth?.accessToken ?? null;
	} catch {
		return null;
	}
}

function pollClaudeUsageFromApi(): void {
	if (!isClaudeHooksSetup() || Date.now() < usageApiBackoffUntil) return;
	const token = readClaudeAccessToken();
	if (!token) return;

	const req = https.get(
		'https://api.anthropic.com/api/oauth/usage',
		{ headers: { Authorization: `Bearer ${token}` } },
		(res) => {
			if (res.statusCode === 429) {
				usageApiBackoffUntil = Date.now() + 30 * 60_000;
				res.resume();
				return;
			}
			if (res.statusCode !== 200) { res.resume(); return; }
			let body = '';
			res.on('data', (c: string) => { body += c; });
			res.on('end', () => {
				try {
					const d = JSON.parse(body);
					const toEpoch = (iso: string | undefined) => iso ? Math.round(new Date(iso).getTime() / 1000) : null;
					handleClaudeUsage({
						fiveHourPct: d.five_hour?.utilization ?? null,
						fiveHourResetsAt: toEpoch(d.five_hour?.resets_at),
						sevenDayPct: d.seven_day?.utilization ?? null,
						sevenDayResetsAt: toEpoch(d.seven_day?.resets_at),
					});
				} catch {}
			});
		},
	);
	req.on('error', () => {});
	req.setTimeout(10000, () => req.destroy());
}

setTimeout(pollClaudeUsageFromApi, 5000);
setInterval(pollClaudeUsageFromApi, 6 * 60_000);

// Wires list/create/update/remove IPC handlers for one entity-collection
// store, following the exact channel-naming convention already used by the
// (now-removed) todos:*/pomodoros:* handlers — `${namespace}:list` etc.
function registerCrudIpc<T extends { id: string; createdAt: number; updatedAt: number }>(
	namespace: string,
	store: ReturnType<typeof createJsonStore<T>>,
) {
	ipcMain.handle(`${namespace}:list`, () => store.list());
	ipcMain.handle(`${namespace}:create`, (_, data: Omit<T, 'createdAt' | 'updatedAt'>) => store.create(data));
	ipcMain.handle(`${namespace}:update`, (_, id: string, patch: Partial<Omit<T, 'id' | 'createdAt'>>) => store.update(id, patch));
	ipcMain.handle(`${namespace}:remove`, (_, id: string) => store.remove(id));
}

function registerValueIpc<T>(namespace: string, store: ReturnType<typeof createJsonValueStore<T>>) {
	ipcMain.handle(`${namespace}:get`, () => store.get());
	ipcMain.handle(`${namespace}:set`, (_, value: T) => store.set(value));
}

// The source app seeded a default list/section/presets on first Firebase
// login (see its lib/userInitializer.ts) — there's no such event here, so
// this runs once on first launch instead, gated by a flag file so it never
// re-seeds after the user deletes everything on purpose.
function ensureSeeded(
	listsStore: ReturnType<typeof createJsonStore<TaskList>>,
	sectionsStore: ReturnType<typeof createJsonStore<Section>>,
	presetsStore: ReturnType<typeof createJsonStore<PomodoroPreset>>,
) {
	const seededFlag = createJsonValueStore<boolean>('seeded.json', false);
	if (seededFlag.get()) return;
	if (listsStore.list().length > 0 || presetsStore.list().length > 0) {
		seededFlag.set(true);
		return;
	}

	const listId = randomUUID();
	const sectionId = randomUUID();

	listsStore.create({ id: listId, name: 'My Tasks', isDefault: true, groupBy: 'sequence', sortBy: 'sequence' });
	sectionsStore.create({ id: sectionId, listId, name: 'Tasks', order: 0 });
	presetsStore.create({ id: randomUUID(), name: 'Classic', focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4, autoStartNext: true });
	presetsStore.create({ id: randomUUID(), name: 'Deep Work', focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20, sessionsBeforeLongBreak: 3, autoStartNext: true });

	seededFlag.set(true);
}

// ── WiFi provisioning ──────────────────────────────────────────────────────────
// Credentials are entered once in this app and sent to the device over the
// existing USB serial link — never typed on the device itself. Once
// connected, the device hosts its own tiny HTTP server (see
// firmware/src/wifi_manager.h) so Claude Code hooks can reach it directly,
// without this app needing to be running.

function resolvePendingWifi(value: unknown) {
	if (!pendingWifiRequest) return;
	clearTimeout(pendingWifiRequest.timeout);
	pendingWifiRequest.resolve(value);
	pendingWifiRequest = null;
}

function rejectPendingWifi(err: Error) {
	if (!pendingWifiRequest) return;
	clearTimeout(pendingWifiRequest.timeout);
	pendingWifiRequest.reject(err);
	pendingWifiRequest = null;
}

function registerWifiIpc() {
	ipcMain.handle('wifi:scan', () => {
		return new Promise<WifiNetwork[]>((resolve, reject) => {
			if (!activePort?.isOpen) { reject(new Error('Device not connected')); return; }
			if (pendingWifiRequest) { reject(new Error('Another WiFi request is already in progress')); return; }
			// WiFi.scanNetworks() on the ESP32 is blocking and commonly takes
			// well over 8s with several nearby networks — give it real headroom.
			const timeout = setTimeout(() => { pendingWifiRequest = null; reject(new Error('Scan timed out')); }, 20000);
			pendingWifiRequest = { resolve: resolve as (v: unknown) => void, reject, timeout };
			activePort.write('#WIFI:SCAN\n');
		});
	});

	ipcMain.handle('wifi:connect', (_, ssid: string, password: string) => {
		return new Promise<WifiConnectResult>((resolve, reject) => {
			if (!activePort?.isOpen) { reject(new Error('Device not connected')); return; }
			if (pendingWifiRequest) { reject(new Error('Another WiFi request is already in progress')); return; }
			const token = randomBytes(16).toString('hex');
			const timeout = setTimeout(() => { pendingWifiRequest = null; reject(new Error('Connect timed out')); }, 20000);
			pendingWifiRequest = {
				resolve: (value) => {
					const result = value as WifiConnectResult;
					if (result.connected) {
						wifiStore?.set({ configured: true, ssid, token });
						if (isClaudeHooksSetup()) setupClaudeHooks();
					}
					resolve(result);
				},
				reject,
				timeout,
			};
			activePort.write(`#WIFI:CONNECT:${token}:${ssid},${password}\n`);
		});
	});

	ipcMain.handle('wifi:status', (): WifiStatus => {
		const cfg = wifiStore?.get() ?? DEFAULT_WIFI_CONFIG;
		return { configured: cfg.configured, ssid: cfg.ssid };
	});

	ipcMain.handle('wifi:forget', () => {
		wifiStore?.set({ configured: false, ssid: null, token: null });
		if (activePort?.isOpen) activePort.write('#WIFI:FORGET\n');
		if (isClaudeHooksSetup()) setupClaudeHooks();
	});

	// Exercises the generic /notify endpoint directly over WiFi — proves the
	// ambient-status feature end-to-end without any Task/Calendar wiring yet.
	ipcMain.handle('wifi:sendNotify', (_, title: string, message: string) => {
		return new Promise<void>((resolve, reject) => {
			const wifi = wifiStore?.get() ?? DEFAULT_WIFI_CONFIG;
			if (!wifi.configured || !wifi.token) { reject(new Error('WiFi not configured')); return; }
			const payload = JSON.stringify({ title, message, color: 0xD3AB, durationMs: 6000 });
			const req = http.request({
				hostname: 'gaze-buddy.local', port: 80, path: '/notify', method: 'POST',
				headers: {
					'X-Gaze-Token': wifi.token,
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(payload),
				},
			}, (res) => {
				res.resume();
				if (res.statusCode === 200) resolve();
				else reject(new Error(`Device responded ${res.statusCode}`));
			});
			req.on('error', (err) => reject(err));
			req.setTimeout(5000, () => { req.destroy(); reject(new Error('Request timed out')); });
			req.write(payload);
			req.end();
		});
	});
}

// Electron's app.setLoginItemSettings/getLoginItemSettings is macOS/Windows
// only — a silent no-op on Linux (no .desktop file, always reports false).
// Linux desktop environments (GNOME/KDE/XFCE/Cinnamon) instead read the
// standard XDG autostart convention: a .desktop file in ~/.config/autostart/.
const LINUX_AUTOSTART_PATH = join(homedir(), '.config', 'autostart', 'gaze-buddy-hub.desktop');

function getLaunchAtLogin(): boolean {
	if (process.platform === 'linux') {
		if (!existsSync(LINUX_AUTOSTART_PATH)) return false;
		try {
			return readFileSync(LINUX_AUTOSTART_PATH, 'utf8').includes('X-GNOME-Autostart-enabled=true');
		} catch {
			return false;
		}
	}
	return app.getLoginItemSettings().openAtLogin;
}

function setLaunchAtLogin(enabled: boolean): void {
	if (process.platform === 'linux') {
		if (!enabled) {
			try { unlinkSync(LINUX_AUTOSTART_PATH); } catch {}
			return;
		}
		mkdirSync(dirname(LINUX_AUTOSTART_PATH), { recursive: true });
		writeFileSync(
			LINUX_AUTOSTART_PATH,
			`[Desktop Entry]\nType=Application\nName=Gaze Buddy Hub\nExec=${process.execPath}\nComment=Gaze Buddy Hub\nX-GNOME-Autostart-enabled=true\nHidden=false\nTerminal=false\n`,
			'utf8',
		);
		return;
	}
	app.setLoginItemSettings({ openAtLogin: enabled });
}

app.whenReady().then(() => {
	const listsStore = createJsonStore<TaskList>('lists.json');
	const sectionsStore = createJsonStore<Section>('sections.json');
	const presetsStore = createJsonStore<PomodoroPreset>('pomodoroPresets.json');
	ensureSeeded(listsStore, sectionsStore, presetsStore);

	registerCrudIpc('lists', listsStore);
	registerCrudIpc('sections', sectionsStore);
	registerCrudIpc('tasks', createJsonStore<Task>('tasks.json'));
	registerCrudIpc('tags', createJsonStore<Tag>('tags.json'));
	registerCrudIpc('events', createJsonStore<CalendarEvent>('events.json'));
	registerCrudIpc('pomodoroPresets', presetsStore);

	registerValueIpc('pomodoroSettings', createJsonValueStore<PomodoroSettings>('pomodoroSettings.json', DEFAULT_POMODORO_SETTINGS));
	registerValueIpc('pomodoroStats', createJsonValueStore<PomodoroStats>('pomodoroStats.json', DEFAULT_POMODORO_STATS));

	wifiStore = createJsonValueStore<WifiConfig>('wifi.json', DEFAULT_WIFI_CONFIG);
	registerWifiIpc();

	createWindow();

	const trayIconPath = app.isPackaged
		? join(process.resourcesPath, 'icons', 'tray.png')
		: join(__dirname, '../build/icons/tray.png');
	tray = new Tray(nativeImage.createFromPath(trayIconPath));
	tray.setToolTip('Gaze Buddy Hub');
	tray.setContextMenu(Menu.buildFromTemplate([
		{ label: 'Show Gaze Buddy Hub', click: () => mainWindow?.show() },
		{ type: 'separator' },
		{
			label: 'Launch at login',
			type: 'checkbox',
			checked: getLaunchAtLogin(),
			click: (menuItem) => setLaunchAtLogin(menuItem.checked),
		},
		{ type: 'separator' },
		{ label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
	]));
	tray.on('click', () => mainWindow?.show());

	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
		else mainWindow?.show();
	});
});

// With mainWindow's own 'close' handler hiding instead of destroying it, this
// only fires on a real quit (tray "Quit", or macOS Cmd+Q) — safe to always
// stop background work here.
app.on('window-all-closed', () => {
	if (autoConnectTimer) clearInterval(autoConnectTimer);
	if (windowTrackerTimer) clearInterval(windowTrackerTimer);
});

app.on('before-quit', () => {
	isQuitting = true;
});

autoUpdater.on('update-downloaded', () => {
	mainWindow?.webContents.send('update:ready');
});

ipcMain.on('update:install', () => autoUpdater.quitAndInstall());

// ── GitHub release helpers ────────────────────────────────────────────────────

function httpsGet(url: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const req = https.get(
			url,
			{ headers: { 'User-Agent': 'gaze-buddy-hub', Accept: 'application/vnd.github.v3+json' } },
			(res) => {
				if (res.statusCode === 301 || res.statusCode === 302) {
					httpsGet(res.headers.location!).then(resolve, reject);
					return;
				}
				let body = '';
				res.on('data', (c: string) => (body += c));
				res.on('end', () => resolve(body));
				res.on('error', reject);
			},
		);
		req.on('error', reject);
		req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')); });
	});
}

function httpsBinary(url: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const req = https.get(url, { headers: { 'User-Agent': 'gaze-buddy-hub' } }, (res) => {
			if (res.statusCode === 301 || res.statusCode === 302) {
				httpsBinary(res.headers.location!).then(resolve, reject);
				return;
			}
			const chunks: Buffer[] = [];
			res.on('data', (c: Buffer) => chunks.push(c));
			res.on('end', () => resolve(Buffer.concat(chunks)));
			res.on('error', reject);
		});
		req.on('error', reject);
		req.setTimeout(60000, () => { req.destroy(); reject(new Error('Download timeout')); });
	});
}

async function fetchLatestRelease(): Promise<{ version: string; firmwareUrl: string } | null> {
	try {
		const body = await httpsGet('https://api.github.com/repos/myk-d/desk-buddy/releases/latest');
		const release = JSON.parse(body);
		const version = release.tag_name?.replace(/^v/, '');
		const asset = release.assets?.find(
			(a: { name: string; browser_download_url: string }) => a.name === 'firmware.bin',
		);
		if (!version || !asset) return null;
		return { version, firmwareUrl: asset.browser_download_url };
	} catch {
		return null;
	}
}

// ── Firmware IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('firmware:getDeviceVersion', () => deviceFirmwareVersion);

ipcMain.handle('firmware:checkUpdate', () => fetchLatestRelease());

ipcMain.handle('firmware:flash', async () => {
	if (isFlashing) throw new Error('Already flashing');

	isFlashing = true;

	try {
		mainWindow?.webContents.send('firmware:progress', 1, 'Fetching release info...');
		const release = await fetchLatestRelease();
		if (!release) throw new Error('No firmware.bin found in latest GitHub release.');

		mainWindow?.webContents.send('firmware:progress', 2, 'Downloading firmware...');
		const bin = await httpsBinary(release.firmwareUrl);

		// Prefer OTA over WiFi when available — sidesteps the USB
		// bootloader-reset dance entirely (this device's Linux USB-CDC driver
		// doesn't support the DTR/RTS toggling esptool needs, forcing the
		// 1200-baud-touch workaround below). Only falls back to USB if WiFi
		// isn't configured or the OTA attempt itself fails.
		const wifi = wifiStore?.get() ?? DEFAULT_WIFI_CONFIG;
		if (wifi.configured && wifi.token) {
			try {
				await otaFlash('gaze-buddy.local', wifi.token, Buffer.from(bin), (pct, status) => {
					mainWindow?.webContents.send('firmware:progress', pct, status);
				});
				return release.version;
			} catch (otaErr: unknown) {
				console.warn('[firmware] OTA flash failed, falling back to USB:', otaErr instanceof Error ? otaErr.message : otaErr);
			}
		}

		// USB fallback — only tear down the live serial connection now that
		// we actually need it, not preemptively before knowing OTA would work.
		const portPath = activePort?.path ?? null;
		if (autoConnectTimer) { clearInterval(autoConnectTimer); autoConnectTimer = null; }
		if (activePort?.isOpen) {
			await new Promise<void>(res => activePort!.close(() => res()));
			activePort = null;
		}
		notifyDisconnected();

		mainWindow?.webContents.send('firmware:progress', 4, 'Triggering bootloader reset...');
		if (portPath) await triggerBootloaderReset(portPath);

		mainWindow?.webContents.send('firmware:progress', 5, 'Waiting for bootloader...');
		const bootPath = await findEspPort();

		await flashFirmware(bootPath, new Uint8Array(bin), (pct, status) => {
			mainWindow?.webContents.send('firmware:progress', pct, status);
		});

		mainWindow?.webContents.send('firmware:progress', 100, `Firmware ${release.version} installed!`);
		return release.version;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		mainWindow?.webContents.send('firmware:error', msg);
		throw err;
	} finally {
		isFlashing = false;
		startAutoConnectScanner();
	}
});

ipcMain.handle('claude:isSetup', () => isClaudeHooksSetup());
ipcMain.handle('claude:setup', () => { setupClaudeHooks(); return true; });
ipcMain.handle('claude:getUsage', () => ({ ...claudeUsage }));
ipcMain.handle('claude:getSource', () => claudeCodeSource);

ipcMain.on('pomodoro:setActive', (_, active: boolean) => {
	isPomodoroActive = active;
	if (!active) lastCategory = null; // re-sync window category after pomodoro ends
});

ipcMain.on('serial:send', (_, packet: string) => {
	const portOpen = activePort?.isOpen ?? false;
	console.log(`[serial:send] packet=${JSON.stringify(packet)} portOpen=${portOpen}`);

	if (activePort && activePort.isOpen) {
		activePort.write(packet, (writeErr) => {
			if (writeErr) {
				console.error('[serial:send] write error:', writeErr.message);
				mainWindow?.webContents.send('serial:data', `[ERR] write: ${writeErr.message}\n`);
				return;
			}
			// drain() hangs on ESP32-S3 USB Serial/JTAG — the kernel driver doesn't
			// implement the drain ioctl. For a 4-byte packet the kernel flushes immediately.
			console.log('[serial:send] write OK');
		});
	} else {
		console.warn('[serial:send] port not open — packet dropped');
		mainWindow?.webContents.send('serial:data', '[ERR] porta не відкрита, пакет скинуто\n');
	}
});
