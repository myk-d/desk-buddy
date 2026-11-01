/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║            BEAK BUDDY — Custom Firmware v3.0              ║
 * ║      ESP32-S3 N16R8 + ILI9341 320×240 + NeoPixel          ║
 * ║                                                            ║
 * ║  Custom build, no servo/U8g2. WiFi is optional, off by     ║
 * ║  default (see wifi_manager.h).                             ║
 * ║  Every character animation — idle/focus/relax/love/error/  ║
 * ║  startup, and ~84 "bonus" ones — is a Taby GIF played      ║
 * ║  from LittleFS (see taby_gif_player.h/taby_screen.h).      ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Protocol (USB Serial, 115200 8N1):
 *   #ANIM:startup\n   — startup animation (plays once)
 *   #ANIM:idle\n      — idle state (default loop)
 *   #ANIM:focus\n     — focus mode
 *   #ANIM:relax\n     — break/relax
 *   #ANIM:love\n      — positive feedback
 *   #ANIM:error\n     — error
 *   #R\n              — software restart
 *   #VERSION\n        — returns the firmware version
 *   #CLAUDE:<sub>\n   — Claude Code state: working/done/waiting/idle (full screen)
 *   #USAGE:<5hPct>,<5hSecs>,<7dPct>,<7dSecs>[,<email>]\n — % and seconds until limits
 *                     reset; trailing email is optional (account email, shown above the cards)
 *   #ANIM:pomowork\n     — Pomodoro: focus (full screen)
 *   #ANIM:pomobreak\n    — Pomodoro: short break (full screen)
 *   #ANIM:pomolongbreak\n — Pomodoro: long break (full screen)
 *   #TIME:<seconds>:<total>\n — updates the timer in ST_POMO_WORK/BREAK/LONGBREAK
 *   #WIFI:SCAN\n                        — scans networks, replies WIFI_NETWORKS:ssid,rssi;...
 *   #WIFI:CONNECT:<token>:<ssid>,<pass>\n — saves credentials and connects, replies WIFI_STATUS:...
 *   #WIFI:STATUS\n                      — current state, replies WIFI_STATUS:...
 *   #WIFI:FORGET\n                      — clears saved credentials, disconnects
 *   #ANIM:sensor\n       — Climate: AHT20+BMP280 temp/humidity/pressure (full screen,
 *                     15s then auto-reverts to whatever was showing before); also pops
 *                     up on its own every 5 min when idle, see pollSensorAutoShow() in
 *                     sensor_screen.h
 *   #TABY:<id>\n         — plays one of ~84 "bonus" character animations ported from the
 *                     original Taby device (e.g. basketball_dunk, boxing, fishing_long,
 *                     thumbs_up...) — not one of the 6 states above, which have their own
 *                     fixed Taby id instead (see enterState() in claude_screen.h). Looping
 *                     ids become the new ambient state (like idle/focus); one-shot ids
 *                     auto-revert to whatever was showing before once they finish. Full
 *                     id list: taby_registry.h.
 *                     Also fires on its own, at a random moment every 3-10 min, with a
 *                     random one-shot reaction — see pollTabyRandomShow() in taby_screen.h.
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
 *   gaze_state.h        — GazeState enum + global state
 *   pomodoro_screen.h   — Pomodoro screen
 *   claude_screen.h     — Claude Code screen + enterState() (state dispatcher)
 *   sensor_screen.h      — Climate (AHT20+BMP280) screen
 *   taby_gif_player.h    — GIF decode/draw (LittleFS, AnimatedGIF) — every character animation goes through this
 *   taby_screen.h        — playTabyAnimation()/pollTabyRandomShow() (#TABY:<id> + random pop-ups)
 *   wifi_manager.h      — WiFi + local web server
 *   serial_protocol.h   — serial protocol (handlePacket/readSerial)
 */

#include <Arduino.h>

#define FIRMWARE_VERSION "0.3.1"

#define LGFX_USE_V1
#include <LovyanGFX.hpp>
#include <Adafruit_NeoPixel.h>

#include "display.h"        // LGFX_BeakBuddy, lcd, pixels, colors
#include "gaze_state.h"      // GazeState enum + currentState/pomoLocked/claude*/taby* globals

// WiFi + local web server — so Claude Code can update the screen directly,
// even when the desktop app is closed. Forward-declared here because
// wifi_manager.h calls them, but they're defined further below in
// claude_screen.h (same translation unit, just a different file).
void applyClaudeState(int sub);
void applyClaudeUsage(float fiveHourPct, long fiveHourSecs, float sevenDayPct, long sevenDaySecs, const String &email);
#include "wifi_manager.h"

#include "pomodoro_screen.h"  // drawPomodoroBackground/drawPomodoroTime

// taby_screen.h's playTabyAnimation() calls enterState() (defined below in
// claude_screen.h) — same forward-declare-what's-needed-early shape as
// applyClaudeState/applyClaudeUsage above.
void enterState(GazeState s);
#include "taby_screen.h"      // TABY_REGISTRY/findTabyAnimation/playTabyAnimation/pollTabyRandomShow — the ~80 "bonus" Taby animations

// enterState() (claude_screen.h) calls drawNotifyScreen()/drawSensorScreen()
// — defined below in notify_screen.h/sensor_screen.h, which themselves need
// enterState() (notify_screen.h calls it from applyNotify(); sensor_screen.h
// doesn't, but is included after for consistency). Same mutual-dependency
// shape as applyClaudeState/applyClaudeUsage above: forward-declare the ones
// needed first.
void drawNotifyScreen();
void drawSensorScreen();
#include "claude_screen.h"    // drawClaudeScreen/drawClaudeUsageBars/enterState/applyClaudeState/applyClaudeUsage
#include "notify_screen.h"    // drawNotifyScreen/applyNotify/pollNotifyTimeout
#include "sensor_screen.h"    // drawSensorScreen/sensorsBegin/pollSensorRead/pollSensorTimeout/pollSensorAutoShow
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

  if (!LittleFS.begin())
  {
    Serial.println("⚠️ LittleFS mount failed — did you run `pio run --target uploadfs`? No character animations (idle/focus/relax/love/error/startup/#TABY:<id>) will be available.");
  }
  tabyGif.begin();
  randomSeed(esp_random()); // hardware RNG — otherwise random() follows the same sequence every boot

  enterState(ST_STARTUP);
  Serial.println("READY");
  Serial.println("FIRMWARE:" FIRMWARE_VERSION);

  sensorsBegin();
  wifiTryAutoConnect();
}

void loop()
{
  readSerial();
  wifiPoll(); // always, regardless of currentState — otherwise HTTP requests aren't handled during Pomodoro/Claude screens
  pollClaudeDoneTimeout(); // same reason — otherwise "Done" would never fade without the app running
  pollNotifyTimeout(); // same reason — otherwise the notify screen would never fade without the app running
  pollSensorRead(); // same reason — otherwise the climate screen would never refresh past its first reading
  pollSensorTimeout(); // same reason — otherwise the climate screen would never auto-revert to idle
  pollSensorAutoShow(); // same reason — otherwise Climate would only ever show when manually triggered
  pollClaudeActivityPulse(); // same reason — the NeoPixel needs to breathe while currentState == ST_CLAUDE
  pollClaudeAnim(); // same reason — drives the claude_in/claude_loop overlay on top of the usage dashboard
  pollTabyRandomShow(); // same reason — otherwise the random "just because" reactions would never fire

  // Pomodoro / Claude Code / Notify / Climate full-screen — no character
  // animation to tick
  if (currentState == ST_POMO_WORK || currentState == ST_POMO_BREAK || currentState == ST_POMO_LONGBREAK || currentState == ST_CLAUDE || currentState == ST_NOTIFY || currentState == ST_SENSOR)
    return;

  // Every remaining state — the 6 dedicated ones (idle/focus/relax/love/
  // error/startup) and ST_TABY (#TABY:<id> bonus animations) — is a Taby
  // GIF ticked here. tabyIsLooping (set in enterState()/playTabyAnimation())
  // says whether reaching the end of the clip means "loop back to frame 0"
  // or "this cycle is done".
  bool finishedCycle = tabyPlayer.tick(tabyIsLooping);
  if (finishedCycle)
  {
    if (currentState == ST_STARTUP)
      enterState(ST_IDLE); // startup animation finished → move to idle
    else if (currentState == ST_TABY && !tabyIsLooping)
      enterState(stateBeforeTaby); // one-shot bonus reaction finished → back to whatever was showing before
  }
}
