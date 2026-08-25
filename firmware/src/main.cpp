/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║            BEAK BUDDY — Custom Firmware v3.0              ║
 * ║      ESP32-S3 N16R8 + ILI9341 320×240 + NeoPixel          ║
 * ║                                                            ║
 * ║  Custom build, no servo/U8g2. WiFi is optional, off by     ║
 * ║  default (see wifi_manager.h).                             ║
 * ║  Content is temporary — animations from Tabbie (idle/      ║
 * ║  focus/relax/love/startup/angry), file format unchanged.   ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Protocol (USB Serial, 115200 8N1):
 *   #ANIM:startup\n   — startup animation (plays once)
 *   #ANIM:idle\n      — idle state (default loop)
 *   #ANIM:focus\n     — focus mode
 *   #ANIM:relax\n     — break/relax
 *   #ANIM:love\n      — positive feedback
 *   #ANIM:error\n     — error (static image, not an animation)
 *   #R\n              — software restart
 *   #VERSION\n        — returns the firmware version
 *   #CLAUDE:<sub>\n   — Claude Code state: working/done/waiting/idle (full screen)
 *   #USAGE:<5hPct>,<5hSecs>,<7dPct>,<7dSecs>\n — % and seconds until limits reset
 *   #ANIM:pomowork\n     — Pomodoro: focus (full screen)
 *   #ANIM:pomobreak\n    — Pomodoro: short break (full screen)
 *   #ANIM:pomolongbreak\n — Pomodoro: long break (full screen)
 *   #TIME:<seconds>:<total>\n — updates the timer in ST_POMO_WORK/BREAK/LONGBREAK
 *   #WIFI:SCAN\n                        — scans networks, replies WIFI_NETWORKS:ssid,rssi;...
 *   #WIFI:CONNECT:<token>:<ssid>,<pass>\n — saves credentials and connects, replies WIFI_STATUS:...
 *   #WIFI:STATUS\n                      — current state, replies WIFI_STATUS:...
 *   #WIFI:FORGET\n                      — clears saved credentials, disconnects
 *
 * Once connected to WiFi, a local web server comes up (port 80, mDNS
 * "beak-buddy.local") with POST /claude-state and /claude-usage — the same
 * request body format the desktop app already POSTs to localhost:7842, plus
 * an X-Beak-Token header (the same token passed in CONNECT). Lets Claude
 * Code update the screen directly even when the app is closed.
 *
 * Why this command format (rather than single-letter #I/#W/...):
 *   new states get added without reflashing the protocol — just a new
 *   line in the dispatch table below.
 *
 * The code is split into files by purpose (all header-only, included
 * directly here, one translation unit, same as before):
 *   display.h         — display/pins/colors
 *   anim_players.h     — animation players (mono + color)
 *   gaze_state.h        — GazeState enum + global state
 *   pomodoro_screen.h   — Pomodoro screen
 *   claude_screen.h     — Claude Code screen + enterState() (state dispatcher)
 *   wifi_manager.h      — WiFi + local web server
 *   serial_protocol.h   — serial protocol (handlePacket/readSerial)
 */

#include <Arduino.h>

#define FIRMWARE_VERSION "0.3.1"

#define LGFX_USE_V1
#include <LovyanGFX.hpp>
#include <Adafruit_NeoPixel.h>

// current animations
#include "boot.h"
#include "idle.h"
#include "work.h"
#include "happy.h"
#include "angry.h"
#include "love.h"

#include "display.h"        // LGFX_BeakBuddy, lcd, pixels, OLED_*, colors
#include "anim_players.h"    // MonoCanvas/canvas, AnimPlayer/player, ColorAnimPlayer/colorPlayer
#include "gaze_state.h"      // GazeState enum + currentState/activeIsColorPlayer/pomoLocked/claude* globals

// WiFi + local web server — so Claude Code can update the screen directly,
// even when the desktop app is closed. Forward-declared here because
// wifi_manager.h calls them, but they're defined further below in
// claude_screen.h (same translation unit, just a different file).
void applyClaudeState(int sub);
void applyClaudeUsage(float fiveHourPct, long fiveHourSecs, float sevenDayPct, long sevenDaySecs);
#include "wifi_manager.h"

#include "pomodoro_screen.h"  // drawPomodoroBackground/drawPomodoroTime

// enterState() (claude_screen.h) calls drawNotifyScreen() — defined below in
// notify_screen.h, which itself needs enterState() (calls it from
// applyNotify()). Same mutual-dependency shape as applyClaudeState/
// applyClaudeUsage above: forward-declare the one that's needed first.
void drawNotifyScreen();
#include "claude_screen.h"    // drawClaudeScreen/drawClaudeUsageBars/enterState/applyClaudeState/applyClaudeUsage
#include "notify_screen.h"    // drawNotifyScreen/applyNotify/pollNotifyTimeout
#include "serial_protocol.h"  // handlePacket/readSerial

void setup()
{
  Serial.begin(BAUD_RATE);

  pinMode(PIN_BACKLIGHT, OUTPUT);
  digitalWrite(PIN_BACKLIGHT, HIGH);

  pixels.begin();
  pixels.setBrightness(80);

  lcd.init();
  lcd.setRotation(3);
  lcd.fillScreen(0x0000);

  canvas.begin();
  if (!colorPlayer.begin())
  {
    Serial.println("⚠️ ColorAnimPlayer: failed to allocate buffer (PSRAM?)");
  }

  enterState(ST_STARTUP);
  Serial.println("READY");
  Serial.println("FIRMWARE:" FIRMWARE_VERSION);

  wifiTryAutoConnect();
}

void loop()
{
  readSerial();
  wifiPoll(); // always, regardless of currentState — otherwise HTTP requests aren't handled during Pomodoro/Claude screens
  pollClaudeDoneTimeout(); // same reason — otherwise "Done" would never fade without the app running
  pollNotifyTimeout(); // same reason — otherwise the notify screen would never fade without the app running
  pollClaudeActivityPulse(); // same reason — the NeoPixel needs to breathe while currentState == ST_CLAUDE

  // Pomodoro / Claude Code / Notify full-screen — no animation, nothing to tick
  if (currentState == ST_POMO_WORK || currentState == ST_POMO_BREAK || currentState == ST_POMO_LONGBREAK || currentState == ST_CLAUDE || currentState == ST_NOTIFY)
    return;

  bool loopAnim = (currentState != ST_STARTUP); // the startup animation only plays once
  bool finished;
  if (activeIsColorPlayer)
    finished = colorPlayer.tick(loopAnim);
  else
    finished = (currentState == ST_ERROR) ? false : player.tick(loopAnim);

  if (finished && currentState == ST_STARTUP)
  {
    enterState(ST_IDLE); // startup animation finished → move to idle
  }
}
