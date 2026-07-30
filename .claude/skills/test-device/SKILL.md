---
name: test-device
description: Run the standard manual test pass against the physical Gaze Buddy device — diagnostics, dashboard, notify auth, non-blocking WiFi scan, Claude Code hooks. Use after firmware changes touching wifi_manager.h, web_server.h, or serial_protocol.h.
---

# Test the physical device

A repeatable smoke-test pass for the Gaze Buddy device's WiFi/HTTP surface and serial protocol. Run this after firmware changes to those areas, or whenever device behavior is in question.

Consider delegating this whole pass to the `device-tester` subagent if you want it run without consuming much of your own context — it already knows the port-conflict gotchas below.

## 0. Check what's using the port

```bash
ps aux | grep -E "electron|npm run dev" | grep -v grep
fuser /dev/ttyACM0 2>&1 || echo "port free"
```

If the app is running, prefer the WiFi/HTTP checks below (they don't need the port). Only take the serial port briefly for step 4 — it self-heals via the app's auto-reconnect scanner (~2s).

## 1. Diagnostics endpoint

```bash
curl -s http://gaze-buddy.local/status.json
```

Expect: valid JSON with `heap`, `rssi`, `uptimeMs`, `state`, `firmware`, `ssid`, `ntpSynced`, `time`. If `ntpSynced` is `true`, sanity-check `time` is a plausible current epoch (not near 0).

## 2. Dashboard

```bash
curl -s http://gaze-buddy.local/ | head -c 500
```

Expect: HTML starting with `<!DOCTYPE html>`, containing the `/status.json`-polling script.

## 3. Notify endpoint — auth and function

Get the current token from an installed hook script:

```bash
TOKEN=$(grep -oP "X-Gaze-Token: \K[a-f0-9]+" ~/.claude/settings.json)
```

Test auth (each should be a single Bash call combining trigger + check, to avoid a concurrent Claude Code hook clobbering device state between separate tool calls):

```bash
curl -s -o /dev/null -w "no token: %{http_code}\n" -X POST http://gaze-buddy.local/notify -d '{}'
curl -s -o /dev/null -w "wrong token: %{http_code}\n" -X POST http://gaze-buddy.local/notify -H "X-Gaze-Token: wrong" -d '{}'
curl -s -o /dev/null -X POST http://gaze-buddy.local/notify -H "X-Gaze-Token: $TOKEN" -d '{"title":"Test","message":"hi","color":2016,"durationMs":5000}'
curl -s http://gaze-buddy.local/status.json
```

Expect: first two → `403`. Last curl's `status.json` check (same command block) → `"state":"notify"`. Wait ~6s and check again separately — should have reverted to `"idle"` (or whatever it was before) unless something else (like your own next tool call's hook) overwrote it first — that's expected interference, not a bug.

## 4. Non-blocking WiFi scan

Only if the port is free (see step 0):

```bash
cd /home/md/Documents/PlatformIO/Projects/Gaze_Buddy/desktop-app && node -e "
const { SerialPort } = require('serialport');
const p = new SerialPort({ path: '/dev/ttyACM0', baudRate: 115200 }, (err) => {
  if (err) { console.error('open error:', err.message); process.exit(1); }
  const t0 = Date.now();
  p.on('data', (d) => console.log(((Date.now()-t0)/1000).toFixed(2)+'s DATA:', JSON.stringify(d.toString())));
  setTimeout(() => { p.write('#WIFI:SCAN\n'); }, 500);
  setTimeout(() => { p.write('#ANIM:idle\n'); }, 700);
  setTimeout(() => { p.close(); process.exit(0); }, 9000);
});
"
```

Expect: the `✅ ANIM → idle` ack arrives within ~100ms of sending it (well before the scan finishes) — proves the scan isn't blocking `loop()`. `WIFI_NETWORKS:...` should still show up ~6-7s later with real nearby SSIDs.

## 5. Claude Code hooks

If hooks are set up (`~/.claude/hooks/*.sh` exist), just make a tool call in an active Claude Code session and confirm the device's `/status.json` briefly shows `"state":"claude"` — this exercises `PreToolUse`/`Stop` without any manual curl needed.

## Reporting

Summarize pass/fail per section — don't just say "tests passed," name what was checked and what came back.
