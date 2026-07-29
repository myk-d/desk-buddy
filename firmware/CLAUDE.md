# Project: Gaze Buddy Firmware

## Overview

C++ firmware for the **Gaze Buddy** desktop gadget: an ESP32-S3 driving a 2.8" ILI9341 color TFT (the main face/eyes display) and an addressable NeoPixel for ambient color. It's controlled two ways at once:

- **USB serial** (115200 8N1) from the companion Electron app (`../desktop-app/`) — the primary control path.
- **WiFi**, once configured — the device hosts its own HTTP server so OTA updates and ambient notifications keep working with the desktop app fully closed. Claude Code hooks *can* post here directly too, but in practice the desktop app should be kept running for accurate stats (see `../desktop-app/CLAUDE.md`).

Board: ESP32-S3 N16R8 (16MB flash, 8MB PSRAM, partition table with dual OTA slots already provisioned — `board_build.partitions = default_16MB.csv`). Current usage is ~17% flash / ~19% RAM — plenty of headroom; the six animation-data headers dominate flash by themselves (~22%), not application logic.

## File layout

Everything is `#pragma once` headers with inline function bodies, `#include`d directly into `main.cpp`'s single translation unit — a deliberate unity build, not real multi-TU compilation. There's exactly one place (`main.cpp`'s include block) where forward declarations exist, for the handful of cases where an early-included file needs to call a function defined later in the chain.

| File | Contents |
|---|---|
| `main.cpp` | Doc comment (protocol reference), includes in dependency order, `setup()`, `loop()` |
| `display.h` | Pin/baud defines, `LGFX_GazeBuddy` (LovyanGFX driver class), `lcd`/`pixels` globals, color constants |
| `anim_players.h` | `MonoCanvas` (legacy 1bpp renderer), `AnimPlayer` (legacy mono player), `ColorAnimPlayer` (RGB565 delta+RLE decoder — what's actually used for all current animations) |
| `gaze_state.h` | `GazeState` enum, `currentState`/`activeIsColorPlayer`/`pomoLocked`, Claude/notify state globals |
| `pomodoro_screen.h` | Full-screen Pomodoro timer display |
| `claude_screen.h` | Full-screen Claude Code status display + **`enterState()`**, the central state-machine dispatcher every screen module funnels through |
| `notify_screen.h` | Generic ambient-status notification screen (`/notify`) — not tied to any specific integration |
| `wifi_manager.h` | WiFi connect/scan/NVS credential storage, mDNS, NTP kickoff, `wifiPoll()` |
| `web_server.h` | The device's own HTTP server — every route handler lives here |
| `serial_protocol.h` | `handlePacket()`/`readSerial()` — the USB serial command dispatcher |
| `boot.h` / `idle.h` / `work.h` / `happy.h` / `angry.h` / `love.h` | Pure `PROGMEM` animation frame data, no logic — don't touch for size reasons without being explicitly asked; there's no space problem to justify it |

Adding a new full-screen feature gets its own `*_screen.h` (mirroring `pomodoro_screen.h`/`claude_screen.h`/`notify_screen.h`, each with an `applyX()` + `pollXTimeout()` pair for non-blocking auto-revert-to-idle). Adding a new HTTP endpoint goes in `web_server.h`.

## Serial protocol (USB, 115200 8N1)

Packets are `#COMMAND:args\n`. Current commands:

| Command | Effect |
|---|---|
| `#ANIM:<name>` | `startup` / `idle` / `focus` / `relax` / `love` / `error` / `pomowork` / `pomobreak` / `pomolongbreak` |
| `#R` | Software restart (`ESP.restart()`) |
| `#VERSION` | Replies `FIRMWARE:<version>` |
| `#CLAUDE:<sub>` | Claude Code full-screen status: `idle` / `working` / `done` / `waiting` |
| `#USAGE:<5hPct>,<5hSecs>,<7dPct>,<7dSecs>` | Session/weekly usage bars (app precomputes the countdown — firmware has no RTC of its own until NTP syncs) |
| `#TIME:<secondsLeft>:<total>` | Updates the Pomodoro timer/progress bar (only while in a Pomodoro state) |
| `#WIFI:SCAN` | Async — replies `WIFI_NETWORKS:ssid,rssi;...` once the scan completes (non-blocking; `loop()` keeps ticking during the ~6-7s scan) |
| `#WIFI:CONNECT:<token>:<ssid>,<password>` | Saves credentials + connects; replies `WIFI_STATUS:connected,<ip>` or `WIFI_STATUS:failed` |
| `#WIFI:STATUS` | Current connection state |
| `#WIFI:FORGET` | Clears saved credentials, disconnects |

`pomoLocked` (set while in any Pomodoro state) blocks `#CLAUDE:`/most `#ANIM:` commands from interrupting a focus session — `idle` and the Pomodoro anims themselves are always allowed through.

## WiFi HTTP server (once configured)

Reachable at `http://gaze-buddy.local` (mDNS) once WiFi is set up via the desktop app (credentials are sent once over USB, never typed on the device). This is what lets OTA updates and `/notify` work with the app fully closed — Claude Code stats, however, are more reliable with the desktop app left running.

| Route | Auth | Purpose |
|---|---|---|
| `POST /claude-state` | `X-Gaze-Token` | Same as `#CLAUDE:` over serial |
| `POST /claude-usage` | `X-Gaze-Token` | Same as `#USAGE:` over serial |
| `POST /notify` | `X-Gaze-Token` | Generic ambient-status notification: `{title, message, color, durationMs}` — not tied to Claude Code, auto-reverts to idle |
| `POST /update` | `X-Gaze-Token` | OTA firmware flash (multipart upload, standard ESP32 `Update.h` two-slot ping-pong — sidesteps USB entirely) |
| `GET /status.json` | none | Diagnostics: heap, RSSI, uptime, current state, firmware version, WiFi SSID, NTP sync status/time |
| `GET /` | none | Small human-readable dashboard, polls `/status.json` client-side |

Read-only/low-sensitivity routes are intentionally unauthenticated (LAN-only, matching common IoT status-page convention); anything that changes device state requires the token. Custom headers (`X-Gaze-Token`) must be explicitly registered via `gazeServer.collectHeaders()` — `WebServer` silently returns `""` for any header not on that list, a bug hit once already.

State-changing HTTP handlers relay back over USB serial (`CLAUDE_RELAY:`, `USAGE_RELAY:`) when connected, so the desktop app's own UI stays in sync even when the update arrived via WiFi and bypassed the app entirely.

## Known hardware limitation

This device's Linux USB-CDC driver doesn't support the DTR/RTS toggling `esptool`'s default bootloader-reset sequence relies on — `pio run --target upload` fails with "No serial data received." The desktop app's own flasher works around this with a 1200-baud-touch reset trick instead (see `../desktop-app/electron/flasher.ts`); OTA over WiFi (`/update`) sidesteps the problem entirely. Claude Code cannot flash the device directly in this environment — compiling is verifiable (`~/.platformio/penv/bin/pio run`, never the bare `pio`), flashing needs the user to trigger it via the app or manually.

See `.claude/skills/flash-firmware/` and `.claude/skills/test-device/` (repo root) for the exact procedures, or delegate to the `firmware-checker`/`device-tester` agents.
