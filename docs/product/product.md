# Beak Buddy — Product

## Vision

Beak Buddy is a personal desk companion that keeps the user's own work state — focus, idle, Pomodoro phase, Claude Code activity — visible at a glance, without pulling their eyes to a monitor. It earns its place on the desk by being reliable and unobtrusive first, and charming (via Taby's character animations) second.

## Users

- **Who**: One person — the user themselves. Not a multi-user device, not shared, not distributed to anyone else.
- **Context**: Sits next to the keyboard on their own desk, always powered, always visible in peripheral vision while they work.
- **Frequency**: Continuous/ambient, all day, every work session — glanced at rather than actively operated. The Claude Code dashboard and Pomodoro screens get more deliberate attention during active coding or focus blocks.

## Positioning

Beak Buddy is a one-person desk gadget, not a product. It has no install base, no app store, no accounts, and no plan to ever have them. It competes with glancing at a taskbar, a second monitor, or a phone — and wins by being ambient and always-on rather than something to check. It is not a smart-home hub (no Home Assistant/IoT-platform integration planned) and not a general notification device — its one deep integration is Claude Code, because that's the tool the user actually lives in daily. Where general IoT/desk-gadget products chase breadth (more integrations, more screens, more config), Beak Buddy has deliberately shed scope — in-app flashing, auto-updates, CI releases, and a denser tile-menu UI were all built and then explicitly reverted — in favor of staying simple, legible, and fun.

## Principles

1. **Ambient over active** — state should be absorbed at a glance, not read like a dashboard that demands attention.
2. **Reliable and unobtrusive beats feature-rich** — if it needs fiddling or produces false states, it has failed, regardless of how many things it tracks.
3. **Personality is part of the function, not decoration** — Taby's animation library is what makes the user want to keep glancing over; it's not skinnable chrome.
4. **Simple full-screen states over dense multi-page UI** — this was tried, reverted, and stays reverted; one state owns the screen at a time.
5. **Scope is earned, not assumed** — new integrations (like the touchscreen, currently wired but unused) only get built out when there's a real, recurring use for them, not because the hardware supports it.
6. **Never a product** — no monetization, no distribution, no accounts, no multi-device design. Every decision optimizes for this one desk, this one user.

## Key flows

1. **Auto-connect & ambient window tracking (default, always-on)** — desktop app detects the device over USB, plays a ~7.6s startup animation, then polls the foreground window (~1.5s) and drives Taby's idle/focus/relax/love/error animation + NeoPixel color to match, for as long as the device is plugged in and the app is running.
2. **Pomodoro session** — user starts a timer on the Pomodoro page; the device screen switches to a full-screen Work/Break/LongBreak progress display, locks out window-tracker interruptions, and reverts to ambient tracking when the session ends or is stopped.
3. **Claude Code activity dashboard** — while the user codes with Claude Code, hooks drive a full-screen device dashboard showing thinking/working/done/waiting status and 5-hour/7-day usage bars, with occasional Taby reaction overlays; the most-used integration, and needs the desktop app running to stay accurate.
4. **WiFi provisioning (one-time/occasional)** — user enters WiFi credentials once in the app's welcome screen or Device page, sent to the device over USB; afterward the device can receive notifications over its own HTTP server even with the app closed.
5. **Ambient notification (device-only, app closed)** — once WiFi is set up, anything on the LAN can `POST /notify` straight to the device to flash a title/message/color for a few seconds before it reverts to idle.
6. **Climate glance** — with the optional AHT20+BMP280 sensor wired, a temperature/humidity/pressure screen auto-pops every 5 minutes (or on-demand), shows for 15s, then reverts to whatever was showing before.
7. **Manual emotion/animation control** — on the Dashboard page the user can manually trigger an ambient state or a `#TABY:<id>` bonus animation, and see a device activity log.
8. **Random "alive" pop-ups** — independent of user action, the device plays a one-shot bonus Taby reaction every 3-10 minutes while an ambient state is showing, so it never feels static.
9. **Firmware flashing (developer-only, manual)** — not a user-facing flow; flashing is fully manual (hold BOOT button) since the app's in-app flashing capability was removed.

## Glossary

- **Taby** — the cartoon character (face/eyes) shown on the device's 2.8" TFT; its animations are the primary expressive surface of the product.
- **Beak Buddy** — the overall product: ESP32-S3 desk gadget + Electron companion app, together.
- **Beak Buddy Hub** — the Electron desktop app (`desktop-app/`) that pairs with the device over USB and/or WiFi.
- **Ambient state** — one of idle/focus/relax/love/error; the default always-on Taby animation + NeoPixel color reflecting the user's current foreground-app classification.
- **Window tracker** — the desktop app component that polls the foreground app (~1.5s) and maps it to an ambient state.
- **Bonus animation** — any of the ~84 non-ambient Taby animations (`#TABY:<id>`), triggered manually or by random pop-ups, distinct from the five core ambient states.
- **Random pop-up** — a one-shot bonus Taby reaction the device plays on its own every 3-10 minutes while an ambient state is showing.
- **Pomodoro lock (`pomoLocked`)** — the state where a running Pomodoro session suppresses window-tracker updates until the session ends or is stopped.
- **Claude Code dashboard** — the full-screen device screen showing Claude Code hook-driven status (thinking/working/done/waiting) and 5h/7d usage bars.
- **Serial protocol** — the USB command set (`#ANIM:`, `#TIME:`, `#CLAUDE:`, `#USAGE:`, `#WIFI:`, `#TABY:`) the desktop app uses to drive the device.
- **Device HTTP server** — the device's own WiFi web server (`POST /notify`, `POST /claude-state`, `POST /claude-usage`, `GET /status.json`, `GET /`), usable without the desktop app running.
- **Ambient notification** — a one-off `POST /notify` message flashed on-device for a few seconds before it reverts to idle.
- **WiFi provisioning** — the one-time USB-delivered WiFi credential handoff (`#WIFI:CONNECT:...`) that enables the device HTTP server.
- **Climate screen** — the optional AHT20+BMP280-driven temperature/humidity/pressure screen that auto-pops every 5 minutes when the sensor is physically present.
- **Device activity log** — the live log of device events shown on the Dashboard page of the desktop app.
- **Touchscreen (XPT2046)** — the resistive touch panel on the display; wired and calibrated at the driver level but with no screen currently reacting to touch (partial/unused).
- **Focus tracker (BEAK)** — this project's internal work-tracking project/epic board; currently has zero epics.

Updated: 2026-11-23
