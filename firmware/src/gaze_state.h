#pragma once

// ═════════════════════════════════════════════════════════════════════════════
// States
// ═════════════════════════════════════════════════════════════════════════════

enum GazeState
{
  ST_STARTUP,
  ST_IDLE,
  ST_FOCUS,
  ST_RELAX,
  ST_LOVE,
  ST_ERROR,
  ST_POMO_WORK,
  ST_POMO_BREAK,
  ST_POMO_LONGBREAK,
  ST_CLAUDE,
  ST_NOTIFY,
  ST_SENSOR,
  ST_TABY
};
GazeState currentState = ST_STARTUP;
bool pomoLocked = false;          // true while pomodoro is running — blocks window-tracker #ANIM: commands

// Claude Code full-screen status — 0=unknown, 1=working, 2=done, 3=waiting
int claudeSubState = 0;
// mainWindow's process used to auto-revert "done" back to idle after 3s, but
// that lived only in the desktop app's setTimeout — direct WiFi hooks bypass
// the app entirely, so the device stayed stuck showing "Done" forever. Same
// 3s revert, now done here so it works with or without the app.
unsigned long claudeDoneAtMs = 0;
const unsigned long CLAUDE_DONE_DISPLAY_MS = 3000;
// Timestamp of the last "working" ping (PreToolUse), used to drive the
// activity-aware NeoPixel breathing pulse in pollClaudeActivityPulse() — a
// static solid color while working looked identical whether Claude was mid
// tool-call-burst or idling on one slow command.
unsigned long lastClaudeWorkingPingMs = 0;
float claudeFiveHourPct = -1;  // -1 = no data yet
float claudeSevenDayPct = -1;
long claudeFiveHourSecsLeft = -1;  // seconds until limit resets (the app computes this, not the firmware)
long claudeSevenDaySecsLeft = -1;
String claudeAccountEmail = ""; // from ~/.claude.json's oauthAccount.emailAddress — the app reads it, firmware just displays it

// Generic ambient-status notification (/notify) — same auto-revert
// pattern as the Claude "done" screen, just not tied to Claude Code at all.
String notifyTitle = "";
String notifyMessage = "";
uint16_t notifyColor = 0xFFFF;
unsigned long notifyAtMs = 0;
unsigned long notifyDurationMs = 5000;

// AHT20+BMP280 climate screen — read every 5 minutes while ST_SENSOR is
// showing (see sensor_screen.h), not continuously, so an unplugged/absent
// sensor doesn't spam I2C traffic while some other screen is up.
bool sensorAvailable = false; // set once in setup() after Wire.begin() + both .begin() calls succeed
float sensorTempC = NAN;
float sensorHumidityPct = NAN;
float sensorPressureHpa = NAN;
unsigned long lastSensorReadMs = 0;
const unsigned long SENSOR_READ_INTERVAL_MS = 300000; // 5 minutes
// Climate is a glance-and-go screen, not a sticky mode like Focus/Relax —
// auto-reverts after SENSOR_DISPLAY_MS back to whatever was showing right
// before it (stateBeforeSensor, captured in showSensorScreen()), so
// interrupting an active ST_CLAUDE limits screen doesn't lose it to idle.
unsigned long sensorShownAtMs = 0;
const unsigned long SENSOR_DISPLAY_MS = 15000;
GazeState stateBeforeSensor = ST_IDLE;
// Also pops up on its own every SENSOR_READ_INTERVAL_MS (see
// pollSensorAutoShow() in sensor_screen.h) instead of only ever showing when
// manually triggered — set once sensors are confirmed present, in
// sensorsBegin(), so the first auto-show waits a full interval after boot
// rather than firing on the very next loop() iteration.
unsigned long lastSensorAutoShowMs = 0;

// Every character animation — the 6 dedicated states (idle/focus/relax/
// love/error/startup, enterState() in claude_screen.h) *and* the ~84 "bonus"
// ones (#TABY:<id>, taby_screen.h) — is now a GIF played from LittleFS via
// tabyPlayer (taby_gif_player.h). tabyIsLooping tells main.cpp's loop()
// whether to keep tabyPlayer.tick()ing the same GIF forever (the 6 dedicated
// states, and a looping bonus animation like busy_loop) or to treat the end
// of the clip as "done" (startup, and a one-shot bonus reaction like
// thumbs_up). stateBeforeTaby is only used by the latter case, to know what
// to revert to — the dedicated states never revert, they *are* the ambient
// state.
GazeState stateBeforeTaby = ST_IDLE;
bool tabyIsLooping = false;
