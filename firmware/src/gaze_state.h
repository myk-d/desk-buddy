#pragma once

// ═════════════════════════════════════════════════════════════════════════════
// Стани
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
  ST_NOTIFY
};
GazeState currentState = ST_STARTUP;
bool activeIsColorPlayer = false; // який плеєр тікати в loop() для поточного стану
bool pomoLocked = false;          // true while pomodoro is running — blocks window-tracker #ANIM: commands

// [НОВЕ] Claude Code full-screen status — 0=невідомо, 1=working, 2=done, 3=waiting
int claudeSubState = 0;
// mainWindow's process used to auto-revert "done" back to idle after 3s, but
// that lived only in the desktop app's setTimeout — direct WiFi hooks bypass
// the app entirely, so the device stayed stuck showing "Done" forever. Same
// 3s revert, now done here so it works with or without the app.
unsigned long claudeDoneAtMs = 0;
const unsigned long CLAUDE_DONE_DISPLAY_MS = 3000;
float claudeFiveHourPct = -1;  // -1 = ще немає даних
float claudeSevenDayPct = -1;
long claudeFiveHourSecsLeft = -1;  // секунд до скидання ліміту (рахує додаток, не прошивка)
long claudeSevenDaySecsLeft = -1;

// [НОВЕ] Generic ambient-status notification (/notify) — same auto-revert
// pattern as the Claude "done" screen, just not tied to Claude Code at all.
String notifyTitle = "";
String notifyMessage = "";
uint16_t notifyColor = 0xFFFF;
unsigned long notifyAtMs = 0;
unsigned long notifyDurationMs = 5000;
