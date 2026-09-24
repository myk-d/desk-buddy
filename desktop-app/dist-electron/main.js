import { app, Tray, nativeImage, Menu, BrowserWindow, ipcMain } from "electron";
import { execSync, exec } from "child_process";
import { randomUUID, randomBytes } from "crypto";
import { join, dirname } from "path";
import http from "http";
import https from "https";
import { writeFileSync, existsSync, readFileSync, unlinkSync, mkdirSync } from "fs";
import { homedir } from "os";
import { SerialPort } from "serialport";
import { fileURLToPath } from "url";
function createJsonStore(filename) {
  const filePath = join(app.getPath("userData"), filename);
  function readAll() {
    if (!existsSync(filePath)) return [];
    try {
      return JSON.parse(readFileSync(filePath, "utf8"));
    } catch (err) {
      console.error(`[store] failed to parse ${filename}:`, err.message);
      return [];
    }
  }
  function writeAll(items) {
    writeFileSync(filePath, JSON.stringify(items, null, 2), "utf8");
  }
  return {
    list() {
      return readAll();
    },
    // Caller supplies `id` (the renderer generates it client-side, e.g. via
    // crypto.randomUUID(), so the ported task-store hooks — which build a
    // full new item and hand it to React state before persistence catches
    // up — never have to reconcile a server-assigned id back into local
    // state). Upserts by id, though in practice this is only ever called
    // for ids that don't exist yet.
    create(data) {
      const now = Date.now();
      const item = { ...data, createdAt: now, updatedAt: now };
      const items = readAll();
      const index = items.findIndex((existing) => existing.id === item.id);
      if (index === -1) items.push(item);
      else items[index] = item;
      writeAll(items);
      return item;
    },
    update(id, patch) {
      const items = readAll();
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) return null;
      const updated = { ...items[index], ...patch, updatedAt: Date.now() };
      items[index] = updated;
      writeAll(items);
      return updated;
    },
    remove(id) {
      writeAll(readAll().filter((item) => item.id !== id));
    }
  };
}
function createJsonValueStore(filename, defaultValue) {
  const filePath = join(app.getPath("userData"), filename);
  return {
    get() {
      if (!existsSync(filePath)) return defaultValue;
      try {
        return JSON.parse(readFileSync(filePath, "utf8"));
      } catch (err) {
        console.error(`[store] failed to parse ${filename}:`, err.message);
        return defaultValue;
      }
    },
    set(value) {
      writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
    }
  };
}
const DEFAULT_POMODORO_SETTINGS = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartNext: true
};
const DEFAULT_POMODORO_STATS = {
  todayDate: "",
  todaySessions: 0,
  todayFocusMinutes: 0,
  totalSessions: 0,
  totalFocusMinutes: 0
};
const DEFAULT_WIFI_CONFIG = { configured: false, ssid: null, token: null };
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = dirname(__filename$1);
let activePort = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;
let autoConnectTimer = null;
let windowTrackerTimer = null;
let isConnecting = false;
let isDeviceConnected = false;
let lastCategory = null;
let isPomodoroActive = false;
let serialLineBuffer = "";
let claudeCodeState = "idle";
let claudeResetTimer = null;
let claudeCodeSource = null;
let claudeUsage = {
  hasData: false,
  fiveHourPct: null,
  fiveHourResetsAt: null,
  sevenDayPct: null,
  sevenDayResetsAt: null
};
let wifiStore = null;
let pendingWifiRequest = null;
const CLAUDE_HOOKS_DIR = join(homedir(), ".claude", "hooks");
const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const CLAUDE_CONFIG_PATH = join(homedir(), ".claude.json");
function readClaudeAccountEmail() {
  var _a;
  try {
    const config = JSON.parse(readFileSync(CLAUDE_CONFIG_PATH, "utf8"));
    return ((_a = config == null ? void 0 : config.oauthAccount) == null ? void 0 : _a.emailAddress) ?? null;
  } catch {
    return null;
  }
}
function localHookTarget() {
  return { host: "127.0.0.1", port: 7842, token: null };
}
function currentHookTarget() {
  const wifi = (wifiStore == null ? void 0 : wifiStore.get()) ?? DEFAULT_WIFI_CONFIG;
  if (wifi.configured && wifi.token) return { host: "beak-buddy.local", port: 80, token: wifi.token };
  return localHookTarget();
}
const IS_WINDOWS = process.platform === "win32";
const WIFI_PROTOCOL_VERSION = 1;
function buildStateHookCommand(target, state) {
  const logPath = join(CLAUDE_HOOKS_DIR, "hook.log");
  if (IS_WINDOWS) {
    const tokenHeader2 = target.token ? ` -H "X-Beak-Token: ${target.token}"` : "";
    return `curl -sS -f -X POST http://${target.host}:${target.port}/claude-state -H "Content-Type: application/json"${tokenHeader2} -d "{\\"v\\":${WIFI_PROTOCOL_VERSION},\\"state\\":\\"${state}\\",\\"source\\":\\"%CLAUDE_CODE_ENTRYPOINT%\\"}" >"${logPath}" 2>&1`;
  }
  const tokenHeader = target.token ? ` -H 'X-Beak-Token: ${target.token}'` : "";
  return `curl -sS -f -X POST http://${target.host}:${target.port}/claude-state -H 'Content-Type: application/json'${tokenHeader} -d "{\\"v\\":${WIFI_PROTOCOL_VERSION},\\"state\\":\\"${state}\\",\\"source\\":\\"\${CLAUDE_CODE_ENTRYPOINT:-unknown}\\"}" >"${logPath}" 2>&1 || true`;
}
function buildStatuslineHook(target, email) {
  const tokenHeader = target.token ? `'X-Beak-Token': '${target.token}', ` : "";
  const emailLiteral = JSON.stringify(email ?? "");
  return `#!/usr/bin/env node
'use strict';
const http = require('http');
const EMAIL = ${emailLiteral};

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
            v: ${WIFI_PROTOCOL_VERSION},
            hasData: true,
            fiveHourPct: fiveHour?.used_percentage ?? null,
            fiveHourResetsAt: fiveHour?.resets_at ?? null,
            fiveHourSecsLeft: secsLeft(fiveHour?.resets_at),
            sevenDayPct: sevenDay?.used_percentage ?? null,
            sevenDayResetsAt: sevenDay?.resets_at ?? null,
            sevenDaySecsLeft: secsLeft(sevenDay?.resets_at),
            email: EMAIL,
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
function isClaudeHooksSetup() {
  var _a, _b, _c, _d;
  try {
    const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
    const hooks = (settings == null ? void 0 : settings.hooks) ?? {};
    const hasHooks = !!(((_a = hooks.PreToolUse) == null ? void 0 : _a.length) && ((_b = hooks.Stop) == null ? void 0 : _b.length) && ((_c = hooks.Notification) == null ? void 0 : _c.length));
    const hasStatusLine = ((_d = settings == null ? void 0 : settings.statusLine) == null ? void 0 : _d.type) === "command";
    return hasHooks && hasStatusLine;
  } catch {
    return false;
  }
}
function setupClaudeHooks() {
  mkdirSync(CLAUDE_HOOKS_DIR, { recursive: true });
  const target = currentHookTarget();
  writeFileSync(join(CLAUDE_HOOKS_DIR, "statusline.js"), buildStatuslineHook(target, readClaudeAccountEmail()), { mode: 493 });
  for (const stale of ["pre-tool.sh", "notification.sh", "stop.sh", "pre-tool.js", "notification.js", "stop.js", "pre-tool.cmd", "notification.cmd", "stop.cmd"]) {
    try {
      unlinkSync(join(CLAUDE_HOOKS_DIR, stale));
    } catch {
    }
  }
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
  } catch {
  }
  settings.hooks = {
    ...settings.hooks ?? {},
    // PreToolUse is matched per-tool, so it needs an explicit wildcard.
    // Stop/Notification/UserPromptSubmit aren't tool-specific — they take
    // no `matcher` field at all.
    //
    // Notification does fire for several unrelated sub-types (auth_success,
    // agent_completed, etc, not just "waiting on you") — tried scoping it
    // with a matcher (permission_prompt|idle_prompt|elicitation_dialog|
    // agent_needs_input) but that's unconfirmed syntax for this hook type,
    // and it's suspected of having broken PreToolUse/Stop too (an invalid
    // entry may make Claude Code reject the whole hooks block, not just
    // this one) — reverted until the correct syntax is confirmed.
    PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: buildStateHookCommand(target, "working") }] }],
    Stop: [{ hooks: [{ type: "command", command: buildStateHookCommand(target, "done") }] }],
    Notification: [{ hooks: [{ type: "command", command: buildStateHookCommand(target, "waiting") }] }],
    // Fires the instant a prompt is submitted, before Claude does anything
    // else — covers the gap between "you asked" and either the first tool
    // call (PreToolUse takes over from there) or a pure-text response with
    // no tools at all (Stop fires next, straight from "thinking" to "done").
    UserPromptSubmit: [{ hooks: [{ type: "command", command: buildStateHookCommand(target, "thinking") }] }]
  };
  settings.statusLine = { type: "command", command: `node ${join(CLAUDE_HOOKS_DIR, "statusline.js")}` };
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}
const TARGET_VID = "303a";
const FOCUS_APPS = /* @__PURE__ */ new Set([
  // editors / IDEs
  "code",
  "code - oss",
  "code - insiders",
  "vscodium",
  "codium",
  "idea",
  "idea64",
  "intellij idea",
  "intellij idea community edition",
  "webstorm",
  "webstorm64",
  "pycharm",
  "pycharm64",
  "pycharm community edition",
  "clion",
  "clion64",
  "goland",
  "goland64",
  "rider",
  "rider64",
  "sublime text",
  "sublime_text",
  "subl",
  "vim",
  "gvim",
  "nvim",
  "emacs",
  "emacs-gtk",
  "gedit",
  "kate",
  "kwrite",
  "mousepad",
  "textmate",
  "xcode",
  // macOS
  "devenv",
  // Visual Studio (Windows)
  "notepad++",
  // Windows
  "eclipse",
  "android studio",
  "arduino ide",
  "arduino-ide",
  // terminals
  "gnome-terminal-server",
  "konsole",
  "xterm",
  "alacritty",
  "kitty",
  "xfce4-terminal",
  "terminal",
  "iterm2",
  "iterm",
  // macOS
  "windowsterminal",
  "cmd",
  "powershell",
  "pwsh"
  // Windows
]);
const RELAX_APPS = /* @__PURE__ */ new Set([
  // browsers
  "google-chrome",
  "google-chrome-stable",
  "google chrome",
  "chrome",
  "firefox",
  "firefox-esr",
  "microsoft-edge",
  "microsoft edge",
  "msedge",
  "safari",
  // macOS
  "brave-browser",
  "brave",
  "chromium",
  "chromium-browser",
  "opera",
  // media
  "spotify",
  "vlc",
  // chat / social
  "discord",
  "slack",
  "telegram",
  "telegram desktop",
  "microsoft teams",
  "teams",
  // games
  "steam"
]);
function classifyApp(appName) {
  if (!appName) return "idle";
  if (FOCUS_APPS.has(appName)) return "focus";
  if (RELAX_APPS.has(appName)) return "relax";
  return "idle";
}
const ANIM_PACKET = {
  focus: "#ANIM:focus\n",
  relax: "#ANIM:relax\n",
  idle: "#ANIM:idle\n"
};
const MODE_LABEL = {
  focus: "WORKING",
  relax: "RELAX",
  idle: "IDLE"
};
const WIN_PS_ENCODED = process.platform === "win32" ? Buffer.from(
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
  "utf16le"
).toString("base64") : "";
async function getActiveWindowApp() {
  try {
    if (process.platform === "linux") {
      const winIdOut = execSync("xprop -root _NET_ACTIVE_WINDOW", { encoding: "utf8", timeout: 800 });
      const winIdMatch = winIdOut.match(/0x[0-9a-f]+/i);
      if (!winIdMatch || winIdMatch[0] === "0x0") return null;
      const classOut = execSync(`xprop -id ${winIdMatch[0]} WM_CLASS`, { encoding: "utf8", timeout: 800 });
      const classMatch = classOut.match(/"([^"]+)"/);
      return classMatch ? classMatch[1].toLowerCase() : null;
    }
    if (process.platform === "darwin") {
      const out = execSync(
        `osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`,
        { encoding: "utf8", timeout: 1500 }
      );
      return out.trim().toLowerCase() || null;
    }
    if (process.platform === "win32") {
      return new Promise((resolve) => {
        exec(
          `powershell -NoProfile -NonInteractive -EncodedCommand ${WIN_PS_ENCODED}`,
          { timeout: 4e3 },
          (err, stdout) => resolve(err ? null : stdout.trim().toLowerCase() || null)
        );
      });
    }
    return null;
  } catch {
    return null;
  }
}
function handleClaudeCodeState(state) {
  if (claudeResetTimer) {
    clearTimeout(claudeResetTimer);
    claudeResetTimer = null;
  }
  claudeCodeState = state;
  mainWindow == null ? void 0 : mainWindow.webContents.send("claude:state", state);
  if (!isDeviceConnected || !(activePort == null ? void 0 : activePort.isOpen)) return;
  activePort.write(`#CLAUDE:${state}
`);
  if (state === "done") {
    claudeResetTimer = setTimeout(() => {
      claudeCodeState = "idle";
      lastCategory = null;
      mainWindow == null ? void 0 : mainWindow.webContents.send("claude:state", "idle");
      if (isDeviceConnected && (activePort == null ? void 0 : activePort.isOpen)) activePort.write("#CLAUDE:idle\n");
    }, 3e3);
  }
}
function handleClaudeUsage(usage) {
  claudeUsage = { ...claudeUsage, ...usage, hasData: true };
  mainWindow == null ? void 0 : mainWindow.webContents.send("claude:usage", { ...claudeUsage });
  if (claudeUsage.fiveHourPct === null || claudeUsage.sevenDayPct === null) return;
  const secsUntil = (resetsAt) => resetsAt ? Math.max(0, Math.round(resetsAt - Date.now() / 1e3)) : 0;
  const fiveHourSecsLeft = secsUntil(claudeUsage.fiveHourResetsAt);
  const sevenDaySecsLeft = secsUntil(claudeUsage.sevenDayResetsAt);
  const email = readClaudeAccountEmail() ?? "";
  const wifi = (wifiStore == null ? void 0 : wifiStore.get()) ?? DEFAULT_WIFI_CONFIG;
  if (wifi.configured && wifi.token) {
    const payload = JSON.stringify({
      v: WIFI_PROTOCOL_VERSION,
      fiveHourPct: Math.round(claudeUsage.fiveHourPct),
      fiveHourSecsLeft,
      sevenDayPct: Math.round(claudeUsage.sevenDayPct),
      sevenDaySecsLeft,
      email
    });
    const req = http.request({
      hostname: "beak-buddy.local",
      port: 80,
      path: "/claude-usage",
      method: "POST",
      headers: { "X-Beak-Token": wifi.token, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
    }, (res) => res.resume());
    req.on("error", () => {
    });
    req.setTimeout(3e3, () => req.destroy());
    req.write(payload);
    req.end();
  }
  if (isDeviceConnected && (activePort == null ? void 0 : activePort.isOpen)) {
    activePort.write(`#USAGE:${Math.round(claudeUsage.fiveHourPct)},${fiveHourSecsLeft},${Math.round(claudeUsage.sevenDayPct)},${sevenDaySecsLeft},${email}
`);
  }
}
function handleClaudeRelay(state) {
  if (state !== "idle" && state !== "thinking" && state !== "working" && state !== "done" && state !== "waiting") return;
  claudeCodeState = state;
  mainWindow == null ? void 0 : mainWindow.webContents.send("claude:state", state);
}
function pollClaudeStateReconciliation() {
  const wifi = (wifiStore == null ? void 0 : wifiStore.get()) ?? DEFAULT_WIFI_CONFIG;
  if (!wifi.configured || claudeCodeState === "idle") return;
  const req = http.get({ hostname: "beak-buddy.local", port: 80, path: "/status.json", timeout: 3e3 }, (res) => {
    let body = "";
    res.on("data", (c) => {
      body += c;
    });
    res.on("end", () => {
      try {
        const d = JSON.parse(body);
        if (d.state !== "claude" && claudeCodeState !== "idle") {
          claudeCodeState = "idle";
          lastCategory = null;
          mainWindow == null ? void 0 : mainWindow.webContents.send("claude:state", "idle");
        }
      } catch {
      }
    });
  });
  req.on("error", () => {
  });
  req.on("timeout", () => req.destroy());
}
setInterval(pollClaudeStateReconciliation, 2e4);
function handleClaudeUsageRelay(fiveHourPct, fiveHourSecsLeft, sevenDayPct, sevenDaySecsLeft) {
  const now = Math.round(Date.now() / 1e3);
  claudeUsage = {
    hasData: true,
    fiveHourPct,
    fiveHourResetsAt: now + fiveHourSecsLeft,
    sevenDayPct,
    sevenDayResetsAt: now + sevenDaySecsLeft
  };
  mainWindow == null ? void 0 : mainWindow.webContents.send("claude:usage", { ...claudeUsage });
}
function startWindowTracker() {
  let isChecking = false;
  windowTrackerTimer = setInterval(async () => {
    if (!isDeviceConnected || !(activePort == null ? void 0 : activePort.isOpen) || isChecking || isPomodoroActive || claudeCodeState !== "idle") return;
    isChecking = true;
    try {
      const appName = await getActiveWindowApp();
      const category = classifyApp(appName);
      if (category === lastCategory) return;
      lastCategory = category;
      activePort.write(ANIM_PACKET[category], (err) => {
        if (err) console.error("[window-tracker] write error:", err.message);
        else {
          console.log(`[window-tracker] → ${MODE_LABEL[category]} (app: ${appName ?? "unknown"})`);
          mainWindow == null ? void 0 : mainWindow.webContents.send("tracker:mode", MODE_LABEL[category]);
        }
      });
    } finally {
      isChecking = false;
    }
  }, 1500);
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname$1, "preload.mjs"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
    startAutoConnectScanner();
    startWindowTracker();
  });
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow == null ? void 0 : mainWindow.hide();
    }
  });
  if (process.env["VITE_DEV_SERVER_URL"]) {
    mainWindow.loadURL(process.env["VITE_DEV_SERVER_URL"]);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(join(__dirname$1, "../dist/index.html"));
  }
}
function notifyDisconnected() {
  if (!isDeviceConnected) return;
  isDeviceConnected = false;
  lastCategory = null;
  mainWindow == null ? void 0 : mainWindow.webContents.send("serial:status", "disconnected");
}
function startAutoConnectScanner() {
  if (autoConnectTimer) clearInterval(autoConnectTimer);
  autoConnectTimer = setInterval(async () => {
    if (activePort && activePort.isOpen || isConnecting) return;
    try {
      const ports = await SerialPort.list();
      const targetDevice = ports.find((p) => {
        var _a;
        return ((_a = p.vendorId) == null ? void 0 : _a.toLowerCase()) === TARGET_VID;
      });
      const espPorts = ports.filter((p) => {
        var _a;
        return ((_a = p.vendorId) == null ? void 0 : _a.toLowerCase()) === TARGET_VID;
      });
      if (espPorts.length > 1) {
        console.warn("[scanner] Знайдено декілька ESP32 портів:", espPorts.map((p) => `${p.path} (PID:${p.productId})`).join(", "));
      }
      if (targetDevice) {
        console.log(`[scanner] Підключаюсь до ${targetDevice.path} (PID:${targetDevice.productId})...`);
        isConnecting = true;
        activePort = new SerialPort({ path: targetDevice.path, baudRate: 115200 }, (err) => {
          isConnecting = false;
          if (err) {
            console.error("Помилка автопідключення:", err.message);
            activePort = null;
            return;
          }
          const thisPort = activePort;
          thisPort.set({ dtr: true }, (setErr) => {
            if (setErr) console.warn("[serial] DTR set error:", setErr.message);
          });
          isDeviceConnected = true;
          mainWindow == null ? void 0 : mainWindow.webContents.send("serial:status", "connected", targetDevice.path);
          thisPort.on("data", (data) => {
            serialLineBuffer += data.toString();
            const lines = serialLineBuffer.split("\n");
            serialLineBuffer = lines.pop() ?? "";
            for (const line of lines) {
              const str = line + "\n";
              const networksMatch = str.match(/WIFI_NETWORKS:([^\r\n]*)/);
              if (networksMatch) {
                const networks = networksMatch[1].split(";").filter(Boolean).map((entry) => {
                  const [ssid, rssi] = entry.split(",");
                  return { ssid, rssi: Number(rssi) };
                });
                resolvePendingWifi(networks);
              }
              const statusMatch = str.match(/WIFI_STATUS:([^\r\n]+)/);
              if (statusMatch) {
                const [state, ip] = statusMatch[1].split(",");
                if (state === "failed") rejectPendingWifi(new Error("Could not connect to that network"));
                else resolvePendingWifi({ connected: state === "connected", ip: ip ?? null });
              }
              const claudeRelayMatch = str.match(/CLAUDE_RELAY:([^\r\n]+)/);
              if (claudeRelayMatch) handleClaudeRelay(claudeRelayMatch[1].trim());
              const usageRelayMatch = str.match(/USAGE_RELAY:([^\r\n]+)/);
              if (usageRelayMatch) {
                const parts = usageRelayMatch[1].split(",").map(Number);
                if (parts.length === 4) handleClaudeUsageRelay(parts[0], parts[1], parts[2], parts[3]);
              }
              mainWindow == null ? void 0 : mainWindow.webContents.send("serial:data", str);
            }
          });
          thisPort.on("close", () => {
            if (activePort === thisPort) activePort = null;
            notifyDisconnected();
          });
          thisPort.on("error", (portErr) => {
            console.error("Serial port error:", portErr.message);
            if (activePort === thisPort) activePort = null;
            notifyDisconnected();
          });
        });
      } else {
        notifyDisconnected();
      }
    } catch (err) {
      console.error("Помилка сканера портів:", err);
    }
  }, 2e3);
}
http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/claude-state") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const d = JSON.parse(body);
        handleClaudeCodeState(d.state);
        if (typeof d.source === "string" && d.source !== claudeCodeSource) {
          claudeCodeSource = d.source;
          mainWindow == null ? void 0 : mainWindow.webContents.send("claude:source", claudeCodeSource);
        }
      } catch {
      }
      res.writeHead(200);
      res.end("ok");
    });
  } else if (req.method === "POST" && req.url === "/claude-usage") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const d = JSON.parse(body);
        handleClaudeUsage({
          fiveHourPct: d.fiveHourPct ?? null,
          fiveHourResetsAt: d.fiveHourResetsAt ?? null,
          sevenDayPct: d.sevenDayPct ?? null,
          sevenDayResetsAt: d.sevenDayResetsAt ?? null
        });
      } catch {
      }
      res.writeHead(200);
      res.end("ok");
    });
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(7842, "127.0.0.1");
const CLAUDE_CREDENTIALS_PATH = join(homedir(), ".claude", ".credentials.json");
let usageApiBackoffUntil = 0;
function readClaudeAccessToken() {
  var _a;
  try {
    const creds = JSON.parse(readFileSync(CLAUDE_CREDENTIALS_PATH, "utf8"));
    return ((_a = creds == null ? void 0 : creds.claudeAiOauth) == null ? void 0 : _a.accessToken) ?? null;
  } catch {
    return null;
  }
}
function pollClaudeUsageFromApi() {
  if (!isClaudeHooksSetup() || Date.now() < usageApiBackoffUntil) return;
  const token = readClaudeAccessToken();
  if (!token) return;
  const req = https.get(
    "https://api.anthropic.com/api/oauth/usage",
    { headers: { Authorization: `Bearer ${token}` } },
    (res) => {
      if (res.statusCode === 429) {
        usageApiBackoffUntil = Date.now() + 30 * 6e4;
        res.resume();
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        return;
      }
      let body = "";
      res.on("data", (c) => {
        body += c;
      });
      res.on("end", () => {
        var _a, _b, _c, _d;
        try {
          const d = JSON.parse(body);
          const toEpoch = (iso) => iso ? Math.round(new Date(iso).getTime() / 1e3) : null;
          handleClaudeUsage({
            fiveHourPct: ((_a = d.five_hour) == null ? void 0 : _a.utilization) ?? null,
            fiveHourResetsAt: toEpoch((_b = d.five_hour) == null ? void 0 : _b.resets_at),
            sevenDayPct: ((_c = d.seven_day) == null ? void 0 : _c.utilization) ?? null,
            sevenDayResetsAt: toEpoch((_d = d.seven_day) == null ? void 0 : _d.resets_at)
          });
        } catch {
        }
      });
    }
  );
  req.on("error", () => {
  });
  req.setTimeout(1e4, () => req.destroy());
}
setTimeout(pollClaudeUsageFromApi, 5e3);
setInterval(pollClaudeUsageFromApi, 6 * 6e4);
function registerCrudIpc(namespace, store) {
  ipcMain.handle(`${namespace}:list`, () => store.list());
  ipcMain.handle(`${namespace}:create`, (_, data) => store.create(data));
  ipcMain.handle(`${namespace}:update`, (_, id, patch) => store.update(id, patch));
  ipcMain.handle(`${namespace}:remove`, (_, id) => store.remove(id));
}
function registerValueIpc(namespace, store) {
  ipcMain.handle(`${namespace}:get`, () => store.get());
  ipcMain.handle(`${namespace}:set`, (_, value) => store.set(value));
}
function ensureSeeded(presetsStore) {
  const seededFlag = createJsonValueStore("seeded.json", false);
  if (seededFlag.get()) return;
  if (presetsStore.list().length > 0) {
    seededFlag.set(true);
    return;
  }
  presetsStore.create({ id: randomUUID(), name: "Classic", focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4, autoStartNext: true });
  presetsStore.create({ id: randomUUID(), name: "Deep Work", focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20, sessionsBeforeLongBreak: 3, autoStartNext: true });
  seededFlag.set(true);
}
function resolvePendingWifi(value) {
  if (!pendingWifiRequest) return;
  clearTimeout(pendingWifiRequest.timeout);
  pendingWifiRequest.resolve(value);
  pendingWifiRequest = null;
}
function rejectPendingWifi(err) {
  if (!pendingWifiRequest) return;
  clearTimeout(pendingWifiRequest.timeout);
  pendingWifiRequest.reject(err);
  pendingWifiRequest = null;
}
function registerWifiIpc() {
  ipcMain.handle("wifi:scan", () => {
    return new Promise((resolve, reject) => {
      if (!(activePort == null ? void 0 : activePort.isOpen)) {
        reject(new Error("Device not connected"));
        return;
      }
      if (pendingWifiRequest) {
        reject(new Error("Another WiFi request is already in progress"));
        return;
      }
      const timeout = setTimeout(() => {
        pendingWifiRequest = null;
        reject(new Error("Scan timed out"));
      }, 2e4);
      pendingWifiRequest = { resolve, reject, timeout };
      activePort.write("#WIFI:SCAN\n");
    });
  });
  ipcMain.handle("wifi:connect", (_, ssid, password) => {
    return new Promise((resolve, reject) => {
      if (!(activePort == null ? void 0 : activePort.isOpen)) {
        reject(new Error("Device not connected"));
        return;
      }
      if (pendingWifiRequest) {
        reject(new Error("Another WiFi request is already in progress"));
        return;
      }
      const token = randomBytes(16).toString("hex");
      const timeout = setTimeout(() => {
        pendingWifiRequest = null;
        reject(new Error("Connect timed out"));
      }, 2e4);
      pendingWifiRequest = {
        resolve: (value) => {
          const result = value;
          if (result.connected) {
            wifiStore == null ? void 0 : wifiStore.set({ configured: true, ssid, token });
            if (isClaudeHooksSetup()) setupClaudeHooks();
          }
          resolve(result);
        },
        reject,
        timeout
      };
      activePort.write(`#WIFI:CONNECT:${token}:${ssid},${password}
`);
    });
  });
  ipcMain.handle("wifi:status", () => {
    const cfg = (wifiStore == null ? void 0 : wifiStore.get()) ?? DEFAULT_WIFI_CONFIG;
    return { configured: cfg.configured, ssid: cfg.ssid };
  });
  ipcMain.handle("wifi:forget", () => {
    wifiStore == null ? void 0 : wifiStore.set({ configured: false, ssid: null, token: null });
    if (activePort == null ? void 0 : activePort.isOpen) activePort.write("#WIFI:FORGET\n");
    if (isClaudeHooksSetup()) setupClaudeHooks();
  });
  ipcMain.handle("wifi:sendNotify", (_, title, message) => {
    return new Promise((resolve, reject) => {
      const wifi = (wifiStore == null ? void 0 : wifiStore.get()) ?? DEFAULT_WIFI_CONFIG;
      if (!wifi.configured || !wifi.token) {
        reject(new Error("WiFi not configured"));
        return;
      }
      const payload = JSON.stringify({ v: WIFI_PROTOCOL_VERSION, title, message, color: 54187, durationMs: 6e3 });
      const req = http.request({
        hostname: "beak-buddy.local",
        port: 80,
        path: "/notify",
        method: "POST",
        headers: {
          "X-Beak-Token": wifi.token,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      }, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else reject(new Error(`Device responded ${res.statusCode}`));
      });
      req.on("error", (err) => reject(err));
      req.setTimeout(5e3, () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });
      req.write(payload);
      req.end();
    });
  });
}
const LINUX_AUTOSTART_PATH = join(homedir(), ".config", "autostart", "beak-buddy-hub.desktop");
function getLaunchAtLogin() {
  if (process.platform === "linux") {
    if (!existsSync(LINUX_AUTOSTART_PATH)) return false;
    try {
      return readFileSync(LINUX_AUTOSTART_PATH, "utf8").includes("X-GNOME-Autostart-enabled=true");
    } catch {
      return false;
    }
  }
  return app.getLoginItemSettings().openAtLogin;
}
function setLaunchAtLogin(enabled) {
  if (process.platform === "linux") {
    if (!enabled) {
      try {
        unlinkSync(LINUX_AUTOSTART_PATH);
      } catch {
      }
      return;
    }
    mkdirSync(dirname(LINUX_AUTOSTART_PATH), { recursive: true });
    writeFileSync(
      LINUX_AUTOSTART_PATH,
      `[Desktop Entry]
Type=Application
Name=Beak Buddy Hub
Exec=${process.execPath}
Comment=Beak Buddy Hub
X-GNOME-Autostart-enabled=true
Hidden=false
Terminal=false
`,
      "utf8"
    );
    return;
  }
  app.setLoginItemSettings({ openAtLogin: enabled });
}
app.whenReady().then(() => {
  const presetsStore = createJsonStore("pomodoroPresets.json");
  ensureSeeded(presetsStore);
  registerCrudIpc("pomodoroPresets", presetsStore);
  registerValueIpc("pomodoroSettings", createJsonValueStore("pomodoroSettings.json", DEFAULT_POMODORO_SETTINGS));
  registerValueIpc("pomodoroStats", createJsonValueStore("pomodoroStats.json", DEFAULT_POMODORO_STATS));
  wifiStore = createJsonValueStore("wifi.json", DEFAULT_WIFI_CONFIG);
  registerWifiIpc();
  createWindow();
  const trayIconName = process.platform === "win32" ? "tray.ico" : "tray.png";
  const trayIconPath = app.isPackaged ? join(process.resourcesPath, "icons", trayIconName) : join(__dirname$1, "../build/icons", trayIconName);
  tray = new Tray(nativeImage.createFromPath(trayIconPath));
  tray.setToolTip("Beak Buddy Hub");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show Beak Buddy Hub", click: () => mainWindow == null ? void 0 : mainWindow.show() },
    { type: "separator" },
    {
      label: "Launch at login",
      type: "checkbox",
      checked: getLaunchAtLogin(),
      click: (menuItem) => setLaunchAtLogin(menuItem.checked)
    },
    { type: "separator" },
    { label: "Quit", click: () => {
      isQuitting = true;
      app.quit();
    } }
  ]));
  tray.on("click", () => mainWindow == null ? void 0 : mainWindow.show());
  app.on("activate", function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow == null ? void 0 : mainWindow.show();
  });
});
app.on("window-all-closed", () => {
  if (autoConnectTimer) clearInterval(autoConnectTimer);
  if (windowTrackerTimer) clearInterval(windowTrackerTimer);
});
app.on("before-quit", () => {
  isQuitting = true;
});
ipcMain.handle("claude:isSetup", () => isClaudeHooksSetup());
ipcMain.handle("claude:setup", () => {
  setupClaudeHooks();
  return true;
});
ipcMain.handle("claude:getUsage", () => ({ ...claudeUsage }));
ipcMain.handle("claude:getSource", () => claudeCodeSource);
ipcMain.handle("claude:getAccountEmail", () => readClaudeAccountEmail());
ipcMain.handle("claude:testIntegration", async () => {
  const hooksConfigured = isClaudeHooksSetup();
  const target = currentHookTarget();
  if (target.host === "127.0.0.1") {
    if (!isDeviceConnected || !(activePort == null ? void 0 : activePort.isOpen)) {
      return { ok: false, hooksConfigured, message: "Hooks target this app’s local relay, but the device isn’t connected over USB right now." };
    }
    handleClaudeCodeState("working");
    setTimeout(() => handleClaudeCodeState("idle"), 1500);
    return { ok: true, hooksConfigured, message: 'Sent a test "working" state to the device over USB — check the screen for a brief flash.' };
  }
  try {
    await new Promise((resolve, reject) => {
      const payload = JSON.stringify({ v: WIFI_PROTOCOL_VERSION, state: "working", source: "test" });
      const req = http.request({
        hostname: target.host,
        port: target.port,
        path: "/claude-state",
        method: "POST",
        headers: {
          ...target.token ? { "X-Beak-Token": target.token } : {},
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      }, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else reject(new Error(`device responded ${res.statusCode}`));
      });
      req.on("error", reject);
      req.setTimeout(5e3, () => {
        req.destroy();
        reject(new Error("timed out"));
      });
      req.write(payload);
      req.end();
    });
    setTimeout(() => {
      const payload = JSON.stringify({ v: WIFI_PROTOCOL_VERSION, state: "idle", source: "test" });
      const req = http.request({
        hostname: target.host,
        port: target.port,
        path: "/claude-state",
        method: "POST",
        headers: {
          ...target.token ? { "X-Beak-Token": target.token } : {},
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      }, (res) => res.resume());
      req.on("error", () => {
      });
      req.write(payload);
      req.end();
    }, 1500);
    return { ok: true, hooksConfigured, message: `Reached the device at ${target.host} — check the screen for a brief "working" flash.` };
  } catch (e) {
    return { ok: false, hooksConfigured, message: `Could not reach the device: ${e.message}` };
  }
});
ipcMain.on("pomodoro:setActive", (_, active) => {
  isPomodoroActive = active;
  if (!active) lastCategory = null;
});
ipcMain.on("serial:send", (_, packet) => {
  const portOpen = (activePort == null ? void 0 : activePort.isOpen) ?? false;
  console.log(`[serial:send] packet=${JSON.stringify(packet)} portOpen=${portOpen}`);
  if (activePort && activePort.isOpen) {
    activePort.write(packet, (writeErr) => {
      if (writeErr) {
        console.error("[serial:send] write error:", writeErr.message);
        mainWindow == null ? void 0 : mainWindow.webContents.send("serial:data", `[ERR] write: ${writeErr.message}
`);
        return;
      }
      console.log("[serial:send] write OK");
    });
  } else {
    console.warn("[serial:send] port not open — packet dropped");
    mainWindow == null ? void 0 : mainWindow.webContents.send("serial:data", "[ERR] porta не відкрита, пакет скинуто\n");
  }
});
