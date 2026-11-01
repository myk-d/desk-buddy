---
name: flash-firmware
description: Compile and redeploy Beak Buddy firmware to the physical device. Use whenever a firmware change needs to reach the actual hardware.
---

# Flash firmware to the device

## 1. Compile

```bash
cd /home/md/Documents/PlatformIO/Projects/Gaze_Buddy/firmware && ~/.platformio/penv/bin/pio run
```

Always the full path, never the bare `pio` command (the system-installed one is broken in this environment). Confirm a clean compile before attempting to flash — check flash/RAM usage in the output, or delegate to the `firmware-checker` agent.

## 2. Why `pio run --target upload` doesn't work here

This device's Linux USB-CDC driver doesn't support the DTR/RTS control-line toggling that `esptool`'s default reset sequence relies on to enter the bootloader. Attempting the standard upload fails with `Failed to connect to ESP32-S3: No serial data received` — this was tried and confirmed to fail; don't re-attempt it as a first option, it wastes time.

## 3. Actual flashing path — manual, every time

The desktop app used to have an "Update Firmware" button (OTA-over-WiFi via `electron/flasher.ts`'s `otaFlash()`, falling back to a 1200-baud-touch USB trick) — that capability was **deliberately removed** from the app, on purpose, not replaced with a standalone script or an OTA-only path. Don't suggest resurrecting it from git history.

Claude Code cannot flash the device itself in this environment (same DTR/RTS limitation, no automatable path left now that the app's flasher is gone). Ask the user to redeploy manually: hold the board's **BOOT button** (forces the native-USB-CDC into ROM download mode regardless of DTR/RTS) while running `~/.platformio/penv/bin/pio run --target upload` from `firmware/`, or while plugging the board in. They've done this reliably before. After they confirm redeployment, verify with `/test-device` or the `device-tester` agent.

**Two separate uploads since the Taby GIF animations landed** — the ~84 bonus character animations (`#TABY:<id>`) live on a LittleFS filesystem partition, not in the firmware binary:

- `~/.platformio/penv/bin/pio run --target upload` — the firmware binary (`factory` app partition). Needed for any code change.
- `~/.platformio/penv/bin/pio run --target uploadfs` — `data/taby/*.gif` (LittleFS partition). Only needed if `data/` changed (new/updated GIFs) — a firmware-only change doesn't need this re-run.

Both need BOOT held the same way. If the device was last flashed before the partition table changed to `partitions_custom.csv` (single app slot + LittleFS, replacing the dual-OTA `default_16MB.csv`), do the firmware upload first — it rewrites the partition table too — before `uploadfs`.

## 4. After flashing

Confirm the new version landed:

```bash
curl -s http://beak-buddy.local/status.json | grep -o '"firmware":"[^"]*"'
```

Or watch for the `FIRMWARE:x.y.z` line on serial connect if testing over USB.
