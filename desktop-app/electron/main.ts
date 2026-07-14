import { app, BrowserWindow, ipcMain } from 'electron';
import { exec, execSync } from 'child_process';
import { dirname, join } from 'path';
import { SerialPort } from 'serialport';
import { fileURLToPath } from 'url';
import { autoUpdater } from 'electron-updater';
import { createJsonStore } from './store';
import type { Todo, PomodoroPreset } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let activePort: SerialPort | null = null;
let mainWindow: BrowserWindow | null = null;
let autoConnectTimer: NodeJS.Timeout | null = null;
let windowTrackerTimer: NodeJS.Timeout | null = null;
let isConnecting = false;
let isDeviceConnected = false;
let lastCategory: Category | null = null;
let isPomodoroActive = false;

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
			if (!winIdMatch) return null;
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

function startWindowTracker() {
	let isChecking = false;
	windowTrackerTimer = setInterval(async () => {
		if (!isDeviceConnected || !activePort?.isOpen || isChecking || isPomodoroActive) return;
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

	if (process.env['VITE_DEV_SERVER_URL']) {
		mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
	} else {
		mainWindow.loadFile(join(__dirname, '../dist/index.html'));
	}
}

function notifyDisconnected() {
	if (!isDeviceConnected) return;
	isDeviceConnected = false;
	lastCategory = null; // reset so reconnect immediately re-syncs state
	mainWindow?.webContents.send('serial:status', 'disconnected');
}

function startAutoConnectScanner() {
	autoConnectTimer = setInterval(async () => {
		if ((activePort && activePort.isOpen) || isConnecting) return;

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
						mainWindow?.webContents.send('serial:data', data.toString());
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

app.whenReady().then(() => {
	const todoStore = createJsonStore<Todo>('todos.json');
	const pomodoroStore = createJsonStore<PomodoroPreset>('pomodoros.json');

	ipcMain.handle('todos:list', () => todoStore.list());
	ipcMain.handle('todos:create', (_, data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => todoStore.create(data));
	ipcMain.handle('todos:update', (_, id: string, patch: Partial<Omit<Todo, 'id' | 'createdAt'>>) => todoStore.update(id, patch));
	ipcMain.handle('todos:remove', (_, id: string) => todoStore.remove(id));

	ipcMain.handle('pomodoros:list', () => pomodoroStore.list());
	ipcMain.handle('pomodoros:create', (_, data: Omit<PomodoroPreset, 'id' | 'createdAt' | 'updatedAt'>) => pomodoroStore.create(data));
	ipcMain.handle('pomodoros:update', (_, id: string, patch: Partial<Omit<PomodoroPreset, 'id' | 'createdAt'>>) => pomodoroStore.update(id, patch));
	ipcMain.handle('pomodoros:remove', (_, id: string) => pomodoroStore.remove(id));

	createWindow();

	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (autoConnectTimer) clearInterval(autoConnectTimer);
	if (windowTrackerTimer) clearInterval(windowTrackerTimer);
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

autoUpdater.on('update-downloaded', () => {
	mainWindow?.webContents.send('update:ready');
});

ipcMain.on('update:install', () => autoUpdater.quitAndInstall());

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
