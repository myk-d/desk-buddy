# Project: Gaze Buddy Hub (Companion App)

## 🎯 Project Overview

**Gaze Buddy Hub** is a desktop companion application designed for the **Gaze Buddy** smart desktop gadget, which is built on the **ESP32-S3** microcontroller.

The primary goal of the app is to automatically track the user's workflow context on their laptop (active windows, running processes, browser tabs) and control the robot's emotions on the desk in real time, as well as provide a clean interface for hardware diagnostics.

---

## 💻 Technology Stack

- **Frontend:** React 18, TypeScript, Vite
- **Backend / System Level:** Electron 30 (Node.js environment with native ES Modules support)
- **Bundling & Build Tools:** `vite-plugin-electron/simple`
- **Hardware Interaction:** `serialport` package (native C++ module for UART/USB CDC communication)

---

## 🏗️ Architecture & Folder Structure

The project is strictly divided into two primary processes:

1. **Main Process (`electron/main.ts`)**
    - Runs in the system Node.js environment.
    - Has full access to the OS and hardware APIs.
    - Manages the lifecycle of Electron windows.
    - Implements a background interval scanner that checks USB ports every 2 seconds for the presence of the ESP32-S3 board (filtering by hardware `vendorId: "303a"`).
    - Handles automatic Plug-and-Play connections without requiring user interaction.

2. **Preload Script (`electron/preload.ts`)**
    - A secure, isolated context bridge between Node.js and the browser renderer engine.
    - Exposes safe Inter-Process Communication (IPC) methods to the global `window.api` object.

3. **Renderer Process (`src/`)**
    - A standard React + TypeScript application.
    - Has no direct access to Node.js; communicates with the hardware exclusively through `window.api`.
    - Renders the status monitor and the manual emotion emulation dashboard.

---

## 🛰️ Data Transfer Protocol (UART Serial)

Communication with the ESP32-S3 board occurs over a USB cable at a baud rate of **115200**.
Data exchange is strictly packet-based, wrapped in envelopes with a start frame marker (`#`) and an end frame marker (`\n`):

| Command     | Packet | Device Screen Behavior Description                                                        |
| :---------- | :----- | :---------------------------------------------------------------------------------------- |
| **IDLE**    | `#I\n` | Standard state. Round cyan eyes, random blinking, and smooth panning to look around.      |
| **WORKING** | `#W\n` | Concentration state. Eyes narrow and move rapidly horizontally (simulating reading code). |
| **SUCCESS** | `#S\n` | Joy emotion. Eyes light up green and turn into satisfied, upward-curved arcs.             |
| **ERROR**   | `#E\n` | Failure/error state. Eyes turn into bright red crosshairs.                                |
| **RESET**   | `#R\n` | Software reset command. Instructs the board to execute a hard reboot via `ESP.restart()`. |

---

## 🚦 Current Implementation Status

- [x] Stable `Vite + React + TS + Electron` boilerplate set up with native ESM support.
- [x] Configured `vite.config.ts` to treat `serialport` as an `external` dependency (preventing Vite from bundling native binaries).
- [x] Implemented background auto-connect to ESP32-S3 via VID (`303a`).
- [x] Built the initial Dashboard UI featuring a manual control panel for testing emotions.
- [ ] **Next Step:** Integrate a system-level service to automatically track active windows in the OS (Linux/Ubuntu) and map them to `WORKING` / `IDLE` states.

---

## 🗺️ Future Roadmap

Planned core features to expand the application into a full productivity hub:

- **Built-in Task Tracker:** A local todo/task management system where task status changes (e.g., finishing a major programming task) trigger the `#S\n` (SUCCESS) or `#E\n` (ERROR) hardware animations.
- **Calendar Integration:** An event calendar to monitor upcoming meetings and schedule pomodoro/focus sessions. Gaze Buddy will adjust its behavior and expressions ahead of or during scheduled events to keep the user on track.
