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
  ST_NOTIFY
};
GazeState currentState = ST_STARTUP;
bool activeIsColorPlayer = false; // which player to tick in loop() for the current state
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
