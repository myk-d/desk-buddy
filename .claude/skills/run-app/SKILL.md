---
name: run-app
description: Launch the Gaze Buddy Hub Electron desktop app in dev mode, and diagnose stale-build symptoms if it crashes with an error that doesn't match what the source actually says.
---

# Run the desktop app

## Launch

```bash
cd /home/md/Documents/PlatformIO/Projects/Gaze_Buddy/desktop-app && npm run dev
```

Run in the background — it's a long-running Vite + Electron dev process. DevTools open automatically (a detached window) in dev mode; that's intentional.

## If it crashes with a confusing error

This project has repeatedly hit `ReferenceError`s pointing at a specific hashed `dist-electron/main-XXXXXXXX.js` chunk that turned out to be a **stale build artifact**, not a real bug — Vite's dev-mode incremental rebuild caught an in-progress edit mid-flight. Signs this is what's happening:

- The named symbol clearly exists and is correctly defined when you `grep` the actual source.
- `ls -la dist-electron/main*.js` shows several accumulated hashed chunks.
- `dist-electron/main.js` (the real entry point) imports a different, newer chunk than the one in the error.

Fix with a full clean rebuild, not more debugging:

```bash
cd /home/md/Documents/PlatformIO/Projects/Gaze_Buddy/desktop-app
rm -rf dist-electron dist
npx tsc
npx vite build
```

Then restart `npm run dev`. Verify the symbol is present in the fresh build with `grep` (it may be renamed/inlined by the minifier — check for the underlying string literals/call sites, e.g. an IPC channel name string, rather than the exact original function name).

## Checking what's running

```bash
ps aux | grep -E "electron|npm run dev" | grep -v grep
fuser /dev/ttyACM0 2>&1 || echo "port free"
```

A running app holds the serial port — relevant before device-testing or firmware-flashing work that also needs it.

Consider delegating this whole skill to the `app-runner` agent if you don't need the output in your own context.
