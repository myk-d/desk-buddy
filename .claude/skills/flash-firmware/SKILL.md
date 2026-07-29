---
name: flash-firmware
description: Compile and redeploy Gaze Buddy firmware to the physical device. Use whenever a firmware change needs to reach the actual hardware.
---

# Flash firmware to the device

## 1. Compile

```bash
cd /home/md/Documents/PlatformIO/Projects/Gaze_Buddy/firmware && ~/.platformio/penv/bin/pio run
```

Always the full path, never the bare `pio` command (the system-installed one is broken in this environment). Confirm a clean compile before attempting to flash — check flash/RAM usage in the output, or delegate to the `firmware-checker` agent.

## 2. Why `pio run --target upload` doesn't work here

This device's Linux USB-CDC driver doesn't support the DTR/RTS control-line toggling that `esptool`'s default reset sequence relies on to enter the bootloader. Attempting the standard upload fails with `Failed to connect to ESP32-S3: No serial data received` — this was tried and confirmed to fail; don't re-attempt it as a first option, it wastes time.

## 3. Actual flashing paths

**Preferred — via the app**: open Gaze Buddy Hub, go to the Device page, click "Update Firmware." As of the OTA feature, this:
- Tries OTA over WiFi first if the device has WiFi configured (`electron/flasher.ts`'s `otaFlash()` → the device's own `/update` endpoint) — no bootloader dance needed at all.
- Falls back to USB via `electron/flasher.ts`'s `flashFirmware()`, which uses a **1200-baud-touch reset trick** (open the port at 1200 baud, then close it — triggers the Arduino ESP32 native-USB-CDC auto-reset into ROM download mode) instead of the DTR/RTS approach, then flashes via `esptool-js` with `no_reset` (since the device is already in bootloader mode).

Note: the app's "Update Firmware" button pulls from the **latest GitHub release**, not whatever's currently sitting in your local `firmware/` working tree — a local-only change needs a release cut (see the `release-cutter` agent / `/release`) before this button will offer it, unless you're testing the OTA/USB mechanism itself rather than your specific change.

**For testing a local build directly**: Claude Code cannot flash the device itself in this environment (same DTR limitation, and no access to trigger the app's own OTA path standalone). Ask the user to redeploy manually — they've done this reliably several times by triggering it themselves outside of what Claude Code can automate here. After they confirm redeployment, verify with `/test-device` or the `device-tester` agent.

## 4. After flashing

Confirm the new version landed:

```bash
curl -s http://gaze-buddy.local/status.json | grep -o '"firmware":"[^"]*"'
```

Or watch for the `FIRMWARE:x.y.z` line on serial connect if testing over USB.
