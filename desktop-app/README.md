# Beak Buddy Hub

Electron companion app for the [Beak Buddy](../firmware) desktop gadget (ESP32-S3 + color TFT + NeoPixel). Auto-connects over USB and drives the device's screen from window activity / Claude Code / Pomodoro sessions.

## Features

- **Auto-connect** to the device over USB (no pairing step — plug in and go)
- **Dashboard** — manual emotion control + live device log
- **Pomodoro** — a focus timer that also drives the device's screen
- **Claude Code integration** — live working/done/waiting state and session/weekly usage bars on the device, from a terminal session, the VS Code extension, or both
- **WiFi provisioning** — connect the device to your network so ambient-status notifications keep working even when this app is closed. Claude Code stats specifically need this app running to stay accurate.

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

## Typecheck

```bash
npx tsc --noEmit
```

No test suite exists — this is the primary automated correctness gate.
