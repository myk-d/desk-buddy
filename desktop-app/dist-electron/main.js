import { app, BrowserWindow, ipcMain } from "electron";
import { execSync, exec } from "child_process";
import { dirname, join } from "path";
import { SerialPort } from "serialport";
import { fileURLToPath } from "url";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = dirname(__filename$1);
let activePort = null;
let mainWindow = null;
let autoConnectTimer = null;
let windowTrackerTimer = null;
let isConnecting = false;
let isDeviceConnected = false;
let lastCategory = null;
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
      if (!winIdMatch) return null;
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
function startWindowTracker() {
  let isChecking = false;
  windowTrackerTimer = setInterval(async () => {
    if (!isDeviceConnected || !(activePort == null ? void 0 : activePort.isOpen) || isChecking) return;
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
  if (process.env["VITE_DEV_SERVER_URL"]) {
    mainWindow.loadURL(process.env["VITE_DEV_SERVER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname$1, "../out/renderer/index.html"));
  }
}
function notifyDisconnected() {
  if (!isDeviceConnected) return;
  isDeviceConnected = false;
  lastCategory = null;
  mainWindow == null ? void 0 : mainWindow.webContents.send("serial:status", "disconnected");
}
function startAutoConnectScanner() {
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
            mainWindow == null ? void 0 : mainWindow.webContents.send("serial:data", data.toString());
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
app.whenReady().then(() => {
  createWindow();
  app.on("activate", function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (autoConnectTimer) clearInterval(autoConnectTimer);
  if (windowTrackerTimer) clearInterval(windowTrackerTimer);
  if (process.platform !== "darwin") {
    app.quit();
  }
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
