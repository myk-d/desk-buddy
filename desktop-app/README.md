# Gaze Buddy Hub

Electron companion app for the [Gaze Buddy](../firmware) desktop gadget (ESP32-S3 + color TFT + NeoPixel). Auto-connects over USB, drives the device's screen from window activity / Claude Code / Pomodoro sessions, and doubles as a small local productivity hub (Tasks, Calendar, Pomodoro).

## Features

- **Auto-connect** to the device over USB (no pairing step — plug in and go)
- **Dashboard** — manual emotion control + live device log
- **Tasks / Calendar / Pomodoro** — local-only productivity tools that also drive the device's screen
- **Claude Code integration** — live working/done/waiting state and session/weekly usage bars on the device, from a terminal session, the VS Code extension, or both
- **WiFi provisioning** — connect the device to your network so Claude Code updates, OTA firmware updates, and ambient-status notifications keep working even when this app is closed
- **Firmware updates** — one click, over WiFi (OTA) when available, USB otherwise

## Development

```bash
npm install
npm run dev
```

DevTools open automatically in dev mode. The app auto-connects to the device the moment it's plugged in — no manual "connect" step.

If you hit a `ReferenceError` after an edit that looks wrong given the source (points at something that's clearly defined correctly), it's most likely a stale Vite dev-build artifact, not a real bug:

```bash
rm -rf dist-electron dist && npx tsc && npx vite build
```

then restart `npm run dev`.

## Building

```bash
npm run build        # Linux
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:all    # Linux + Windows
```

## Releasing

Releases are cut via CI (`.github/workflows/build.yml`, manually triggered), keyed off this package's `version` field — it builds and publishes the firmware binary *and* all platform installers to a single GitHub release tagged `v<version>`. Bump the version here (and `FIRMWARE_VERSION` in `../firmware/src/main.cpp` to keep the device's self-reported version in sync), then trigger the workflow — don't build/publish manually with `npm run release`/`release:mac` unless you specifically need to bypass CI.

## Typecheck

```bash
npx tsc --noEmit
```

No test suite exists — this is the primary automated correctness gate.
