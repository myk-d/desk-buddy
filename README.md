# Gaze Buddy

A desktop gadget (ESP32-S3 + color TFT + NeoPixel) that reflects your workflow — what app you're focused on, whether Claude Code is working, Pomodoro sessions — as a face on a little screen next to your keyboard.

Two parts, one repo:

- **[`firmware/`](firmware)** — the C++ firmware running on the device itself.
- **[`desktop-app/`](desktop-app)** — the Electron companion app that drives it, plus a small local productivity hub (Tasks/Calendar/Pomodoro).

## How it fits together

The desktop app auto-connects to the device over USB and sends it simple text commands (`#ANIM:idle`, `#CLAUDE:working`, etc. — see [`firmware/CLAUDE.md`](firmware/CLAUDE.md) for the full protocol). Once you connect the device to WiFi (optional, from the app's Device page), it also hosts its own small HTTP server — so OTA firmware updates and ambient-status notifications keep working even when the desktop app is closed entirely. Claude Code stats are the exception: keep the desktop app running for those to stay accurate (see `desktop-app/CLAUDE.md`).

```
┌─────────────────┐   USB serial    ┌──────────────────┐
│  Gaze Buddy Hub  │ ◄─────────────► │  ESP32-S3 device │
│  (Electron app)  │                 │  (this firmware) │
└─────────────────┘                 └──────────────────┘
                                       ▲
                                       │ WiFi (optional, once configured)
                                       │ Claude Code hooks · OTA · /notify
                                       ▼
                              anything on your LAN
```

## Getting started

**Firmware** (PlatformIO):
```bash
cd firmware
~/.platformio/penv/bin/pio run             # compile
# flashing needs either the desktop app's "Update Firmware" button (OTA/USB)
# or a manual redeploy — see firmware/CLAUDE.md, "Known hardware limitation"
```

**Desktop app**:
```bash
cd desktop-app
npm install
npm run dev
```

See [`desktop-app/README.md`](desktop-app/README.md) for the full development/build/release workflow.

## Docs

- [`docs/claude-code-integration.md`](docs/claude-code-integration.md) — setting up and troubleshooting the Claude Code ↔ device integration.
- [`firmware/CLAUDE.md`](firmware/CLAUDE.md) / [`desktop-app/CLAUDE.md`](desktop-app/CLAUDE.md) — architecture notes for each half of the project.

## Working on this repo with Claude Code

This repo has project-specific subagents (`.claude/agents/`) and skills (`.claude/skills/`) for common workflows — compiling/typechecking, testing the physical device, flashing, adding a new WiFi endpoint or IPC channel, and cutting a release. Worth checking before reinventing one of these from scratch:

| Need to... | Use |
|---|---|
| Compile firmware and check flash/RAM usage | `firmware-checker` agent |
| Typecheck the desktop app | `app-typechecker` agent |
| Test the physical device (WiFi endpoints, serial commands) | `device-tester` agent / `/test-device` |
| Run or diagnose the desktop app | `app-runner` agent / `/run-app` |
| Flash new firmware to the device | `/flash-firmware` |
| Add a new device HTTP endpoint | `/add-wifi-endpoint` |
| Add a new IPC channel (app main ↔ renderer) | `/add-ipc-channel` |
| Plan a new feature | `repo-planner` agent |
| Cut a release | `release-cutter` agent |
