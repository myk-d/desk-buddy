# Regression checklist

Key flows from `product.md`. No automated test suite exists for this project (desktop app: `npx tsc --noEmit` only typechecks; firmware: PlatformIO compile only, no unit tests) — `auto` entries below are typecheck/compile gates, not behavior tests. Everything else needs the physical device and/or a human driving the app.

## 1. Auto-connect & ambient window tracking
- **Steps**: Plug device into USB with app closed, then launch Beak Buddy Hub. Switch foreground app across a few categories (browser, editor, idle) over ~2 min.
- **Expected**: Startup animation (~7.6s) plays to completion uninterrupted before any ambient state takes over. Then idle/focus/relax/love/error animation + NeoPixel color follow the foreground app, updating ~1.5s after each switch.
- **Type**: device + manual
- **Covers**: none

## 2. Pomodoro session
- **Steps**: Start a Work session from the Pomodoro page; let it run (or fast-forward if possible) through Work → Break → LongBreak; stop a session early.
- **Expected**: Device screen switches to full-screen Pomodoro progress display matching the phase; window-tracker updates are suppressed (`pomoLocked`) for the whole session; ambient tracking resumes immediately on end/stop.
- **Type**: manual + device
- **Covers**: none

## 3. Claude Code activity dashboard
- **Steps**: Run an active Claude Code session (hooks installed) while the desktop app is running; separately, trigger a state via the device's WiFi relay (`/claude-state`, `/claude-usage`) with hooks as the source.
- **Expected**: Device shows full-screen dashboard with thinking/working/done/waiting status and 5h/7d usage bars updating correctly; occasional Taby reaction overlays appear without breaking the dashboard layout; same result whether driven over USB (hooks → app → serial) or WiFi relay.
- **Type**: device + manual
- **Covers**: `.claude/skills/test-device/` step 5 (Claude Code hooks → `"state":"claude"`)

## 4. WiFi provisioning
- **Steps**: On the welcome screen or Device page, enter WiFi credentials once over USB; then disconnect USB/close the app and confirm the device is reachable on the LAN.
- **Expected**: Device connects to WiFi and keeps its HTTP server up with USB disconnected and the app closed; credentials persist across device reboot.
- **Type**: manual + device
- **Covers**: none

## 5. Ambient notification (device-only, app closed)
- **Steps**: With app fully closed and device on WiFi, `POST /notify` with a title/message/color (with and without the auth token).
- **Expected**: Correctly authed request flashes the message for its duration then reverts to idle; unauthed/wrong-token requests are rejected (`403`).
- **Type**: device
- **Covers**: `.claude/skills/test-device/` steps 1–3 (status endpoint, dashboard, notify auth/function)

## 6. Climate glance
- **Steps**: With AHT20+BMP280 sensor attached, wait for the 5-minute auto pop-up; separately trigger it manually via `#ANIM:sensor`.
- **Expected**: Temp/humidity/pressure screen shows plausible readings, stays up ~15s, then reverts to whatever was showing before (ambient state, dashboard, etc.) in both the auto and manual-trigger cases.
- **Type**: device
- **Covers**: none

## 7. Manual emotion/animation control + device log
- **Steps**: On the Dashboard page, manually trigger an ambient state and a `#TABY:<id>` bonus animation; watch the device activity log while doing so.
- **Expected**: Device screen updates to match each manual trigger; activity log on the Dashboard page reflects each action in near-real-time.
- **Type**: manual + device
- **Covers**: none

## 8. Random "alive" pop-ups
- **Steps**: Leave the device idle (ambient state showing, app running) for 10+ minutes, observing continuously.
- **Expected**: At least one unprompted bonus Taby reaction fires within the 3–10 min window, then the device reverts to the prior ambient state on its own.
- **Type**: device
- **Covers**: none

## 9. Firmware flashing (dev-only)
- **Steps**: `~/.platformio/penv/bin/pio run` to compile; if flashing, hold BOOT button and flash manually.
- **Expected**: Compiles cleanly with no errors; manual BOOT-button flash succeeds (brief check only — not a user-facing flow).
- **Type**: auto (compile) + manual (flash)
- **Covers**: none
