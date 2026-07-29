/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║            GAZE BUDDY — Custom Firmware v3.0              ║
 * ║      ESP32-S3 N16R8 + ILI9341 320×240 + NeoPixel          ║
 * ║                                                            ║
 * ║  Власна версія, без сервоприводу/U8g2. WiFi опціональний,  ║
 * ║  вимикається за замовчуванням (див. wifi_manager.h).      ║
 * ║  Контент тимчасово — анімації з Tabbie (idle/focus/relax/  ║
 * ║  love/startup/angry), формат файлів НЕ змінений.           ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Протокол (USB Serial, 115200 8N1):
 *   #ANIM:startup\n   — стартова анімація (один прогін)
 *   #ANIM:idle\n      — стан спокою (default loop)
 *   #ANIM:focus\n     — режим фокусу
 *   #ANIM:relax\n     — перерва/відпочинок
 *   #ANIM:love\n      — позитивний відгук
 *   #ANIM:error\n     — помилка (статична картинка, не анімація)
 *   #R\n              — програмний рестарт
 *   #VERSION\n        — повернути версію прошивки
 *   #CLAUDE:<sub>\n   — Claude Code стан: working/done/waiting/idle (повний екран)
 *   #USAGE:<5hPct>,<5hSecs>,<7dPct>,<7dSecs>\n — % і секунди до скидання лімітів
 *   #ANIM:pomowork\n     — Pomodoro: фокус (повний екран)
 *   #ANIM:pomobreak\n    — Pomodoro: коротка перерва (повний екран)
 *   #ANIM:pomolongbreak\n — Pomodoro: довга перерва (повний екран)
 *   #TIME:<секунди>:<всього>\n — оновлює таймер у ST_POMO_WORK/BREAK/LONGBREAK
 *   #WIFI:SCAN\n                        — сканує мережі, відповідь WIFI_NETWORKS:ssid,rssi;...
 *   #WIFI:CONNECT:<token>:<ssid>,<pass>\n — зберігає й підключається, відповідь WIFI_STATUS:...
 *   #WIFI:STATUS\n                      — поточний стан, відповідь WIFI_STATUS:...
 *   #WIFI:FORGET\n                      — стирає збережені дані, від'єднує
 *
 * Після підключення до WiFi піднімається локальний веб-сервер (порт 80,
 * mDNS "gaze-buddy.local") з POST /claude-state і /claude-usage — той самий
 * формат тіла запиту, що вже POST'ить desktop-застосунок на localhost:7842,
 * плюс заголовок X-Gaze-Token (той самий токен, що передавався в CONNECT).
 * Дозволяє Claude Code оновлювати екран напряму, коли застосунок закритий.
 *
 * Чому саме такий формат команд (а не однобуквені #I/#W/...):
 *   нові стани додаються без перепрошивки протоколу — просто новий
 *   рядок у dispatch-таблиці нижче.
 *
 * Код розділено на файли за призначенням (усі — header-only, включаються
 * прямо сюди, один translation unit, як і раніше):
 *   display.h         — дисплей/піни/кольори
 *   anim_players.h     — плеєри анімацій (mono + кольорові)
 *   gaze_state.h        — GazeState enum + глобальний стан
 *   pomodoro_screen.h   — екран Pomodoro
 *   claude_screen.h     — екран Claude Code + enterState() (диспетчер станів)
 *   wifi_manager.h      — WiFi + локальний веб-сервер
 *   serial_protocol.h   — серійний протокол (handlePacket/readSerial)
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

#include "display.h"        // LGFX_GazeBuddy, lcd, pixels, OLED_*, кольори
#include "anim_players.h"    // MonoCanvas/canvas, AnimPlayer/player, ColorAnimPlayer/colorPlayer
#include "gaze_state.h"      // GazeState enum + currentState/activeIsColorPlayer/pomoLocked/claude* globals

// [НОВЕ] WiFi + локальний веб-сервер — щоб Claude Code міг оновлювати екран
// напряму, навіть коли desktop-застосунок закритий. Forward-declared тут,
// бо wifi_manager.h викликає їх, а визначені вони нижче — у claude_screen.h
// (той самий translation unit, просто інший файл).
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
  lcd.setRotation(1);
  lcd.fillScreen(0x0000);

  canvas.begin();
  if (!colorPlayer.begin())
  {
    Serial.println("⚠️ ColorAnimPlayer: не вдалось виділити буфер (PSRAM?)");
  }

  enterState(ST_STARTUP);
  Serial.println("READY");
  Serial.println("FIRMWARE:" FIRMWARE_VERSION);

  wifiTryAutoConnect();
}

void loop()
{
  readSerial();
  wifiPoll(); // завжди, незалежно від currentState — інакше HTTP-запити не обробляються під час Pomodoro/Claude екранів
  pollClaudeDoneTimeout(); // так само — інакше "Done" ніколи не згасне без запущеного застосунку
  pollNotifyTimeout(); // так само — інакше notify-екран ніколи не згасне без запущеного застосунку

  // [НОВЕ] Pomodoro / Claude Code / Notify full-screen — без анімації, нічого тікати не потрібно
  if (currentState == ST_POMO_WORK || currentState == ST_POMO_BREAK || currentState == ST_POMO_LONGBREAK || currentState == ST_CLAUDE || currentState == ST_NOTIFY)
    return;

  bool loopAnim = (currentState != ST_STARTUP); // стартова анімація грає лише раз
  bool finished;
  if (activeIsColorPlayer)
    finished = colorPlayer.tick(loopAnim);
  else
    finished = (currentState == ST_ERROR) ? false : player.tick(loopAnim);

  if (finished && currentState == ST_STARTUP)
  {
    enterState(ST_IDLE); // стартова анімація закінчилась → переходимо в idle
  }
}
