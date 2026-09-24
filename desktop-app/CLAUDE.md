# Project: Beak Buddy Hub (Companion App)

## Overview

**Beak Buddy Hub** is the Electron companion app for the Beak Buddy desktop gadget (`../firmware/`). It auto-connects to the device over USB and drives its screen based on window-tracking/Claude Code/Pomodoro activity. It also handles WiFi-provisioning the device so ambient notifications keep working when the app itself is closed — Claude Code stats are the exception, see below.

Tasks, Calendar, in-app firmware flashing (the "Update Firmware" button + `electron/flasher.ts`), and the app's own electron-updater auto-update check existed in an earlier version of this app and were deliberately removed — don't resurrect that code from git history without being asked. See "Firmware updates" below for how flashing works now.

## Technology stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v4 (`stone`/`brand` color idiom throughout — no `tailwind.config.js`, theme lives in `@theme` in `index.css`)
- **Backend/system:** Electron 30, native ESM
- **Hardware:** `serialport` (native module, marked `external` in `vite.config.ts` so Vite doesn't try to bundle it)
- **No test suite** — `npx tsc --noEmit` is the primary automated correctness gate. No HTTP client library either (raw `http`/`https` throughout, deliberately, for consistency)

## Architecture

1. **Main process (`electron/main.ts`)** — full OS/hardware access. Background auto-connect scanner (polls every ~2s for VID `303a`), the Claude Code hook HTTP server (`localhost:7842`), all persistence, all IPC handlers.
2. **Preload (`electron/preload.ts`)** — `contextBridge` exposing a curated `window.api` surface; renderer has no direct Node access.
3. **Renderer (`src/`)** — React app. Pages: Dashboard (manual emotion control + device log), Pomodoro, Device (Claude Code/WiFi settings).

### Persistence

- `createJsonStore<T>(filename)` (`electron/store.ts`) — CRUD collections, one flat JSON array file, full read-modify-write (currently just `pomodoroPresets.json`).
- `createJsonValueStore<T>(filename, default)` — single-value blobs (`wifi.json`, pomodoro settings/stats).
- `useRemoteCollection` (`src/hooks/useRemoteCollection.ts`) — the renderer-side half: fetches once on mount, then diffs every local state change and pushes `create`/`update`/`remove` back. **This is one-way, renderer → main only.** Anything that originates in the main process (a poller, a WiFi-relayed update) needs an explicit push event (`mainWindow.webContents.send(...)` + `ipcRenderer.on` in preload) — there's no polling fallback anywhere in the hooks.

### IPC

Every new surface is a three-file change: `electron/main.ts` (`ipcMain.handle`/`.on`), `electron/preload.ts` (bridge), `src/types.ts` (`Window.api` type). A typecheck failure naming a `window.api.*` property almost always means one of the three was missed.

## Serial protocol

See `../firmware/CLAUDE.md` for the authoritative, current command list (`#ANIM:`, `#CLAUDE:`, `#USAGE:`, `#TIME:`, `#WIFI:*`, `#VERSION`, `#R`) — don't duplicate it here where it can drift out of sync; the firmware doc comment in `main.cpp` is the source of truth.

## Claude Code integration

The Device page can show live thinking/working/done/waiting state and session/weekly usage bars, driven three different ways depending on what's available:

- **Hooks** (`UserPromptSubmit`/`PreToolUse`/`Stop`/`Notification`, written to `~/.claude/hooks/` by `setupClaudeHooks()` in `main.ts`) fire from *both* a terminal session and the VS Code extension — these drive the state indicator. `UserPromptSubmit` covers the gap between "you asked" and the first tool call (or, for a pure-text reply with no tools, straight through to `Stop`) — without it the device just sat on whatever the previous turn left behind while Claude was composing a response.
- **`statusLine`** (also hook-generated) only ever fires from a real terminal — it's the source of the live usage-percentage data, and carries `$CLAUDE_CODE_ENTRYPOINT` so the UI can show *which* front-end most recently fired.
- **Account-usage API poll** (`pollClaudeUsageFromApi()`, every 6 min) — a fallback specifically for the VS Code-extension case, reading `~/.claude/.credentials.json`'s OAuth token and hitting Anthropic's own (undocumented) usage endpoint directly. App-process-only by design — it does not run on the device, so it stops updating once the app is closed.

Hooks target either `localhost:7842` (this app's own relay server) or `beak-buddy.local` directly (once WiFi is configured, with an `X-Beak-Token` header) — `setupClaudeHooks()` regenerates them on every WiFi connect/forget so they always point at the right place. In principle a real terminal session's `statusLine` posting straight to the device should keep usage stats current even with the app closed, but in practice this hasn't been reliable — **the desktop app should be kept running for accurate Claude Code session/usage stats on the device**, regardless of WiFi setup. See `docs/claude-code-integration.md` for the user-facing version of this.

The currently-logged-in account's email (`readClaudeAccountEmail()`, reading `oauthAccount.emailAddress` from `~/.claude.json` — separate from `.credentials.json`'s OAuth token) rides along with the usage data on every path above: it's read fresh each time `handleClaudeUsage()` composes an outgoing WiFi POST or `#USAGE:` serial write, and it's baked as a static `EMAIL` constant into the generated `statusline.js` at `setupClaudeHooks()` time (that script runs standalone once WiFi is configured, so it can't re-read the config file itself). The Device page also fetches it once via `claude:getAccountEmail` for its own "Account" row.

## WiFi provisioning

Opt-in via a welcome screen on first pairing (or later from the Device page). Credentials are entered in the app and sent to the device once over the existing USB link — **never typed on the device**. Once connected, the device hosts its own HTTP server (see `../firmware/CLAUDE.md`) so the generic `/notify` endpoint works with the app fully closed. Claude Code stats are the exception — see above.

## Firmware updates

The app itself has no way to flash firmware anymore — no "Update Firmware" button, no `electron/flasher.ts`, no `firmware:*` IPC, no GitHub-release-fetching. That capability was deliberately removed, and deliberately **not** replaced with a standalone script or an OTA-only path — firmware now gets flashed by hand every time (hold the board's BOOT button to force bootloader mode, since this device's USB-CDC driver doesn't support the DTR/RTS reset `pio run --target upload` normally relies on; see `firmware/CLAUDE.md`'s "Known hardware limitation").

There is also no more CI release pipeline — `.github/workflows/build.yml` (which used to build firmware + all platform installers and publish them to a single GitHub release) and the `release-cutter` agent that drove it were both deleted, since nothing consumes a published release anymore (no in-app firmware fetch, no `electron-updater` app auto-update either). `npm run build`/`build:mac`/`build:win`/`build:all` in `desktop-app/` still work for a plain local build; `npm run release`/`release:mac` (electron-builder with `--publish always`) still exist in `package.json` but nothing triggers them automatically now — don't resurrect the CI workflow or the agent from git history without being asked.

## Known gotchas

- **Stale dev builds**: Vite's incremental rebuild can catch an edit mid-flight and produce a genuinely broken `dist-electron/main-<hash>.js` that throws a `ReferenceError` for something that's clearly correct in source. Fix is `rm -rf dist-electron dist && npx tsc && npx vite build`, not more debugging — see `.claude/skills/run-app/` (repo root).
- **`cwd` can reset** between tool calls in long sessions — `cd desktop-app` before running `tsc`/`pio` if a command unexpectedly fails with an unrelated error.
