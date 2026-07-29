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
 */

#include <Arduino.h>

#define FIRMWARE_VERSION "0.3.0"

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

// [НОВЕ] WiFi + локальний веб-сервер — щоб Claude Code міг оновлювати екран
// напряму, навіть коли desktop-застосунок закритий. Included last among the
// top headers so forward-declared applyClaudeState/applyClaudeUsage resolve
// once they're defined later in this file (single translation unit).
#include "wifi_manager.h"

// ═════════════════════════════════════════════════════════════════════════════
// Піни (перевірені на платі)
// ═════════════════════════════════════════════════════════════════════════════

#define PIN_BACKLIGHT 21
#define PIN_NEOPIXEL 48
#define BAUD_RATE 115200

// ═════════════════════════════════════════════════════════════════════════════
// LovyanGFX — ILI9341 320×240 SPI
// ═════════════════════════════════════════════════════════════════════════════

class LGFX_GazeBuddy : public lgfx::LGFX_Device
{
  lgfx::Panel_ILI9341 _panel;
  lgfx::Bus_SPI _bus;

public:
  LGFX_GazeBuddy()
  {
    auto b = _bus.config();
    b.spi_host = SPI2_HOST;
    b.spi_mode = 0;
    b.freq_write = 40000000;
    b.freq_read = 16000000;
    b.pin_sclk = 12;
    b.pin_mosi = 11;
    b.pin_miso = 13;
    b.pin_dc = 14;
    _bus.config(b);
    _panel.setBus(&_bus);

    auto p = _panel.config();
    p.pin_cs = 10;
    p.pin_rst = 9;
    p.panel_width = 240;
    p.panel_height = 320;
    p.offset_x = 0;
    p.offset_y = 0;
    p.rgb_order = false;
    _panel.config(p);
    _panel.setInvert(false);
    setPanel(&_panel);
  }
};

LGFX_GazeBuddy lcd;
Adafruit_NeoPixel pixels(1, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);

// ── 128×64 "віртуальний" канвас — масштабується на справжній екран ─────────
#define OLED_W 128
#define OLED_H 64
#define OLED_SCALE 2
const int OLED_DRAW_W = OLED_W * OLED_SCALE;
const int OLED_DRAW_H = OLED_H * OLED_SCALE;
const int OLED_DRAW_X = (320 - OLED_DRAW_W) / 2;
const int OLED_DRAW_Y = (240 - OLED_DRAW_H) / 2;

// ── [НОВЕ] Повноекранний режим Pomodoro — без анімації взагалі ─────────────
// Кольори відповідають React-застосунку: #38bdf8 (робота), #4ade80 (перерва)
#define POMO_WORK_COLOR 0x3DFF
#define POMO_BREAK_COLOR 0x4EF0
#define POMO_LONGBREAK_COLOR 0x633D  // indigo — той самий #6366f1, що й React PHASE_META.longBreak

// ── [НОВЕ] Claude Code full-screen status — окремий екран, без анімації ────
// Дизайн орієнтований на брендовий колір Claude (термакота/orange #D97757).
#define CLAUDE_WORKING_COLOR 0xD3AB  // Claude orange (#D97757)
#define CLAUDE_DONE_COLOR 0x4EF0     // той самий зелений, що й pomo break
#define CLAUDE_WAITING_COLOR 0xF800  // яскраво-червоний
#define CLAUDE_NEUTRAL_COLOR 0x39C7  // сірий — заглушка, поки немає sub-стану
#define CLAUDE_BG_DARK 0x0862        // майже чорний фон екрану
#define CLAUDE_CARD_BG 0x18C4        // фон картки статистики
#define CLAUDE_TRACK_COLOR 0x2965    // фон доріжки прогрес-бару
#define CLAUDE_TEXT_MUTED 0x8430     // приглушений сірий текст
#define CLAUDE_PCT_5H_COLOR 0xD3AB   // бар сесії (5h) — orange
#define CLAUDE_PCT_7D_COLOR 0xF9F0   // бар тижня (7d) — pink

// ── [НОВЕ] Буфер для кольорових (RGB565 delta+RLE) анімацій ────────────────
// Має збігатись з FIRMWARE_CROP_W_MAX/H_MAX у convert_animation.mjs.
#define COLOR_CROP_W_MAX 310
#define COLOR_CROP_H_MAX 160
#define COLOR_MAX_PIXELS (COLOR_CROP_W_MAX * COLOR_CROP_H_MAX)

// ═════════════════════════════════════════════════════════════════════════════
// MonoCanvas — рендер 1bpp Adafruit_GFX-бітмапа (MSB зліва) у заданому кольорі,
// з масштабуванням на справжній екран через спрайт-буфер
// ═════════════════════════════════════════════════════════════════════════════

class MonoCanvas
{
public:
  LGFX_Sprite buf;

  MonoCanvas() : buf(&lcd) {}

  void begin()
  {
    buf.setColorDepth(16);
    buf.createSprite(OLED_W, OLED_H);
    buf.fillScreen(0x0000);
  }

  void clear() { buf.fillScreen(0x0000); }

  // bitmap: 1bpp, MSB зліва, byteWidth байт на рядок (як у idle01.h/focus01.h/...)
  // Draws both ON (color) and OFF (black) pixels so caller doesn't need clear().
  void drawBitmap(const uint8_t *bitmap, int byteWidth, int h, uint16_t color)
  {
    int w = byteWidth * 8;
    for (int row = 0; row < h; row++)
    {
      const uint8_t *rowPtr = bitmap + row * byteWidth;
      uint8_t b = pgm_read_byte(rowPtr);
      int col = 0;
      while (col < w)
      {
        uint16_t c = ((b >> (7 - (col & 7))) & 1) ? color : 0x0000;
        int start = col;
        do
        {
          col++;
          if ((col & 7) == 0 && col < w)
            b = pgm_read_byte(rowPtr + (col >> 3));
        } while (col < w && (((b >> (7 - (col & 7))) & 1) ? color : 0x0000) == c);
        buf.fillRect(start, row, col - start, 1, c);
      }
    }
  }

  void present()
  {
    const uint16_t *raw = (const uint16_t *)buf.getBuffer();
    lcd.startWrite();
    for (int y = 0; y < OLED_H; y++)
    {
      const uint16_t *row = raw + y * OLED_W;
      int x = 0;
      while (x < OLED_W)
      {
        uint16_t c = row[x];
        int start = x++;
        while (x < OLED_W && row[x] == c)
          x++;
        lcd.fillRect(OLED_DRAW_X + start * OLED_SCALE, OLED_DRAW_Y + y * OLED_SCALE,
                     (x - start) * OLED_SCALE, OLED_SCALE, c);
      }
    }
    lcd.endWrite();
  }
};

MonoCanvas canvas;

// ═════════════════════════════════════════════════════════════════════════════
// AnimPlayer — універсальний плеєр для xxx_frames[] + xxx_FRAME_COUNT/FPS
// (структура файлів НЕ змінена — це той самий формат, що в idle01.h і т.д.)
// ═════════════════════════════════════════════════════════════════════════════

class AnimPlayer
{
public:
  void load(const uint8_t *const *frames, uint16_t count, uint16_t frameDelayMs,
            int byteWidth, int height, uint16_t color)
  {
    _frames = frames;
    _count = count;
    _delayMs = frameDelayMs;
    _byteWidth = byteWidth;
    _height = height;
    _color = color;
    _frame = 0;
    _lastMs = millis();
    _drawFrame(0); // одразу показуємо перший кадр, не чекаючи таймера
  }

  // Повертає true, якщо це був останній кадр одноразової анімації
  bool tick(bool loop)
  {
    if (!_frames)
      return false;
    if (millis() - _lastMs < _delayMs)
      return false;
    _lastMs = millis();
    _frame++;
    if (_frame >= _count)
    {
      if (loop)
      {
        _frame = 0;
      }
      else
      {
        _frame = _count - 1;
        _drawFrame(_frame);
        return true;
      }
    }
    _drawFrame(_frame);
    return false;
  }

private:
  const uint8_t *const *_frames = nullptr;
  uint16_t _count = 0, _delayMs = 125, _frame = 0;
  int _byteWidth = 16, _height = 64;
  uint16_t _color = 0xFFFF;
  unsigned long _lastMs = 0;

  void _drawFrame(uint16_t idx)
  {
    const uint8_t *data = (const uint8_t *)pgm_read_ptr(&_frames[idx]);
    canvas.drawBitmap(data, _byteWidth, _height, _color);
    canvas.present();
  }
};

AnimPlayer player;

// ═════════════════════════════════════════════════════════════════════════════
// [НОВЕ] ColorAnimPlayer — той самий decode-алгоритм, що в convert_animation.mjs:
// кадр 0 = повний RLE-кейфрейм, кадри 1+ = тільки змінені пікселі (delta),
// SKIP = кадр ідентичний попередньому (нічого не перемальовуємо).
//
// На відміну від MonoCanvas (128×64, масштабується), ця анімація малюється
// напряму у своїх власних екранних координатах (CROP_X/Y/W/H з заголовка) —
// бо вона вже повноколірна і в "природній" роздільності, без масштабування.
// ═════════════════════════════════════════════════════════════════════════════

class ColorAnimPlayer
{
public:
  // Викликати один раз у setup() — виділяє PSRAM-буфер під максимальний кроп
  bool begin()
  {
    _buf = (uint16_t *)ps_malloc(COLOR_MAX_PIXELS * sizeof(uint16_t));
    if (_buf == nullptr)
      _buf = (uint16_t *)malloc(COLOR_MAX_PIXELS * sizeof(uint16_t));
    return _buf != nullptr;
  }

  // cropX/cropY/cropW/cropH — координати відносно того ж 128×64 "віртуального"
  // полотна Rive, що й mono-анімації. Масштаб і центрування на справжній
  // екран рахуються тим самим OLED_SCALE/OLED_DRAW_X/Y, що й для них —
  // тож обидва типи контенту виглядають узгоджено в одному "просторі".
  void load(const uint8_t *const *frames, const uint16_t *sizes, const uint8_t *types,
            uint16_t count, uint8_t fps,
            uint16_t cropX, uint16_t cropY, uint16_t cropW, uint16_t cropH)
  {
    _frames = frames;
    _sizes = sizes;
    _types = types;
    _count = count;
    _frameMs = 1000u / fps;
    _cropW = cropW;
    _cropH = cropH;
    _drawX = OLED_DRAW_X + cropX * OLED_SCALE;
    _drawY = OLED_DRAW_Y + cropY * OLED_SCALE;
    _frame = 0;
    _lastMs = millis();
    memset(_buf, 0, sizeof(uint16_t) * (uint32_t)cropW * cropH);
    _renderFrame(0);
  }

  // loop=false: зупиняється на останньому кадрі й повертає true (один раз) —
  // потрібно для стартової анімації, яка має передати керування в idle.
  bool tick(bool loop)
  {
    if (_buf == nullptr)
      return false;
    if (millis() - _lastMs < _frameMs)
      return false;
    _lastMs = millis();
    _frame++;
    if (_frame >= _count)
    {
      if (loop)
      {
        _frame = 0;
      }
      else
      {
        _frame = _count - 1;
        _renderFrame(_frame);
        return true;
      }
    }
    _renderFrame(_frame);
    return false;
  }

private:
  uint16_t *_buf = nullptr;
  const uint8_t *const *_frames = nullptr;
  const uint16_t *_sizes = nullptr;
  const uint8_t *_types = nullptr;
  uint16_t _count = 0, _frame = 0;
  uint32_t _frameMs = 50;
  int32_t _drawX = 0, _drawY = 0;  // реальні екранні координати лівого верхнього кута
  uint16_t _cropW = 0, _cropH = 0; // розмір у "віртуальних" пікселях (до масштабу)
  unsigned long _lastMs = 0;

  void _renderFrame(uint16_t idx)
  {
    uint8_t type = pgm_read_byte(&_types[idx]);
    if (type == 2)
      return; // SKIP — екран уже показує правильний кадр

    uint16_t size = pgm_read_word(&_sizes[idx]);
    const uint8_t *data = (const uint8_t *)pgm_read_ptr(&_frames[idx]);
    if (type == 0)
      _decodeKey(data, size);
    else
      _decodeDelta(data, size);

    _blit();
  }

  void _decodeKey(const uint8_t *data, uint16_t size)
  {
    uint32_t pi = 0, bi = 0;
    while (bi < (uint32_t)size)
    {
      uint8_t cnt = pgm_read_byte(data + bi);
      uint16_t col = ((uint16_t)pgm_read_byte(data + bi + 1) << 8) | pgm_read_byte(data + bi + 2);
      bi += 3;
      for (uint8_t c = 0; c < cnt && pi < COLOR_MAX_PIXELS; c++)
        _buf[pi++] = col;
    }
  }

  void _decodeDelta(const uint8_t *data, uint16_t size)
  {
    uint32_t bi = 0;
    while (bi < (uint32_t)size)
    {
      uint32_t off = ((uint16_t)pgm_read_byte(data + bi) << 8) | pgm_read_byte(data + bi + 1);
      uint8_t cnt = pgm_read_byte(data + bi + 2);
      uint16_t col = ((uint16_t)pgm_read_byte(data + bi + 3) << 8) | pgm_read_byte(data + bi + 4);
      bi += 5;
      for (uint8_t c = 0; c < cnt; c++)
      {
        uint32_t pi = off + c;
        if (pi < COLOR_MAX_PIXELS)
          _buf[pi] = col;
      }
    }
  }

  // Масштабований блит через горизонтальні рани однакового кольору —
  // та сама техніка, що в MonoCanvas::present(), лише тут кольори
  // справжні (RGB565), а не лише фон/не-фон.
  void _blit()
  {
    for (uint16_t y = 0; y < _cropH; y++)
    {
      uint16_t x = 0;
      while (x < _cropW)
      {
        uint16_t c = _buf[(uint32_t)y * _cropW + x];
        uint16_t start = x;
        while (x < _cropW && _buf[(uint32_t)y * _cropW + x] == c)
          x++;
        lcd.fillRect(_drawX + start * OLED_SCALE, _drawY + y * OLED_SCALE,
                     (x - start) * OLED_SCALE, OLED_SCALE, c);
      }
    }
  }
};

ColorAnimPlayer colorPlayer;

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
  ST_CLAUDE
};
GazeState currentState = ST_STARTUP;
bool activeIsColorPlayer = false; // який плеєр тікати в loop() для поточного стану
bool pomoLocked = false;          // true while pomodoro is running — blocks window-tracker #ANIM: commands

// [НОВЕ] Claude Code full-screen status — 0=невідомо, 1=working, 2=done, 3=waiting
int claudeSubState = 0;
float claudeFiveHourPct = -1;  // -1 = ще немає даних
float claudeSevenDayPct = -1;
long claudeFiveHourSecsLeft = -1;  // секунд до скидання ліміту (рахує додаток, не прошивка)
long claudeSevenDaySecsLeft = -1;

// [НОВЕ] Pomodoro — повний екран, без анімації. Фон малюється один раз при
// вході в стан (enterState), текст часу й прогрес-бар — окремо, при кожному
// #TIME:, щоб не перемальовувати весь екран щосекунди (менше SPI-трафіку).

void drawPomodoroBackground(uint16_t bg, const char *label)
{
  lcd.fillScreen(bg);
  lcd.setTextSize(2);
  lcd.setTextColor(0xFFFF, bg);
  int textW = strlen(label) * 6 * 2;
  lcd.setCursor((320 - textW) / 2, 40);
  lcd.print(label);
}

void drawPomodoroTime(int secondsLeft, int totalSeconds)
{
  if (secondsLeft < 0)
    secondsLeft = 0;
  uint16_t bg = (currentState == ST_POMO_WORK) ? POMO_WORK_COLOR : POMO_BREAK_COLOR;

  char buf[8];
  snprintf(buf, sizeof(buf), "%d:%02d", secondsLeft / 60, secondsLeft % 60);

  // Великий час, по центру — ширина рахується динамічно (4 чи 5 символів
  // мають різну ширину, інакше центрування "стрибало" б при зміні хвилин)
  lcd.fillRect(0, 90, 320, 70, bg);
  lcd.setTextSize(8);
  lcd.setTextColor(0xFFFF, bg);
  int textW = strlen(buf) * 6 * 8;
  lcd.setCursor((320 - textW) / 2, 95);
  lcd.print(buf);

  // Прогрес-бар знизу — заповнюється зліва направо за минулий час
  const int barX = 20, barY = 210, barW = 280, barH = 6;
  float frac = (totalSeconds > 0) ? (float)(totalSeconds - secondsLeft) / totalSeconds : 0.0f;
  if (frac < 0)
    frac = 0;
  if (frac > 1)
    frac = 1;
  lcd.fillRect(barX, barY, barW, barH, bg);
  lcd.fillRect(barX, barY, (int)(barW * frac), barH, 0xFFFF);
}

// [НОВЕ] Claude Code — тонка кольорова смужка стану зверху + дві картки
// статистики (SESSION 5h / WEEKLY 7d), стилізовані під rounded stat cards.
// Смужка малюється лише при зміні sub-стану (drawClaudeScreen), картки
// оновлюються окремо (drawClaudeUsageBars), щоб #USAGE: не перемальовував
// весь екран щоразу.

void formatResetsIn(char *buf, size_t bufSize, long secs)
{
  if (secs <= 0)
  {
    buf[0] = '\0';
    return;
  }
  long days = secs / 86400;
  long hours = (secs % 86400) / 3600;
  long mins = (secs % 3600) / 60;
  if (days > 0)
    snprintf(buf, bufSize, "resets in %ldd %ldh", days, hours);
  else if (hours > 0)
    snprintf(buf, bufSize, "resets in %ldh %ldm", hours, mins);
  else
    snprintf(buf, bufSize, "resets in %ldm", mins);
}

void drawClaudeCard(int x, int y, int w, int h, const char *label, float pct, uint16_t barColor, long secsLeft)
{
  lcd.fillRoundRect(x, y, w, h, 10, CLAUDE_CARD_BG);

  lcd.setTextSize(1);
  lcd.setTextColor(CLAUDE_TEXT_MUTED, CLAUDE_CARD_BG);
  lcd.setCursor(x + 14, y + 12);
  lcd.print(label);

  char pctBuf[8];
  if (pct >= 0)
    snprintf(pctBuf, sizeof(pctBuf), "%d%%", (int)(pct + 0.5f));
  else
    snprintf(pctBuf, sizeof(pctBuf), "--");
  lcd.setTextSize(3);
  lcd.setTextColor(pct >= 0 ? 0xFFFF : CLAUDE_TEXT_MUTED, CLAUDE_CARD_BG);
  lcd.setCursor(x + 14, y + 28);
  lcd.print(pctBuf);

  const int barX = x + 14, barW = w - 28, barH = 8, barY = y + h - 32;
  lcd.fillRoundRect(barX, barY, barW, barH, barH / 2, CLAUDE_TRACK_COLOR);
  if (pct >= 0)
  {
    float frac = pct / 100.0f;
    if (frac > 1)
      frac = 1;
    if (frac < 0.04f)
      frac = 0.04f; // лишаємо видиму крапку навіть при ~0%
    int fillW = (int)(barW * frac);
    lcd.fillRoundRect(barX, barY, fillW, barH, barH / 2, barColor);
    lcd.fillCircle(barX + fillW, barY + barH / 2, 6, barColor);
  }

  char resetsBuf[32];
  formatResetsIn(resetsBuf, sizeof(resetsBuf), secsLeft);
  lcd.setTextSize(1);
  lcd.setTextColor(CLAUDE_TEXT_MUTED, CLAUDE_CARD_BG);
  lcd.setCursor(x + 14, y + h - 14);
  lcd.print(resetsBuf);
}

void drawClaudeUsageBars()
{
  if (currentState != ST_CLAUDE)
    return;
  lcd.fillRect(0, 30, 320, 210, CLAUDE_BG_DARK);
  drawClaudeCard(10, 38, 300, 96, "SESSION (5H)", claudeFiveHourPct, CLAUDE_PCT_5H_COLOR, claudeFiveHourSecsLeft);
  drawClaudeCard(10, 140, 300, 96, "WEEKLY (7D)", claudeSevenDayPct, CLAUDE_PCT_7D_COLOR, claudeSevenDaySecsLeft);
}

void drawClaudeScreen()
{
  uint16_t stripColor;
  const char *label;
  switch (claudeSubState)
  {
  case 1:
    stripColor = CLAUDE_WORKING_COLOR;
    label = "WORKING";
    break;
  case 2:
    stripColor = CLAUDE_DONE_COLOR;
    label = "DONE";
    break;
  case 3:
    stripColor = CLAUDE_WAITING_COLOR;
    label = "NEEDS INPUT";
    break;
  default:
    stripColor = CLAUDE_NEUTRAL_COLOR;
    label = "CLAUDE CODE";
    break;
  }

  lcd.fillScreen(CLAUDE_BG_DARK);
  lcd.fillRect(0, 0, 320, 30, stripColor);
  lcd.setTextSize(1);
  lcd.setTextColor(0x0000, stripColor); // чорний текст — краще видно на маленькому екрані, ніж білий
  lcd.setCursor(10, 11);
  lcd.print("CLAUDE CODE");
  int labelW = strlen(label) * 6;
  lcd.setCursor(310 - labelW, 11);
  lcd.print(label);

  drawClaudeUsageBars();
}

void setNeo(uint8_t r, uint8_t g, uint8_t b)
{
  pixels.setPixelColor(0, pixels.Color(r, g, b));
  pixels.show();
}

// Кожен стан: масив кадрів, кількість, затримка, колір, чи зациклювати
void enterState(GazeState s)
{
  currentState = s;
  activeIsColorPlayer = false; // за замовчуванням mono; колірні стани виставлять true самі

  // [ФІКС] Pomodoro малює на ВЕСЬ екран, інші стани — лише в маленькій
  // центральній області. Тому чистимо весь екран при БУДЬ-якій зміні
  // стану — інакше після Pomodoro навколо anімації лишався б старий фон/текст.
  lcd.fillScreen(0x0000);

  // Auto-lock during pomodoro states; unlock when leaving them
  pomoLocked = (s == ST_POMO_WORK || s == ST_POMO_BREAK || s == ST_POMO_LONGBREAK);

  switch (s)
  {
  case ST_STARTUP:
    // [НОВЕ] startup01.h тепер теж кольоровий (RGB565 delta+RLE) — конвертований
    // зі старою назвою BOOT_ANIM, тому й префікс констант саме такий.
    activeIsColorPlayer = true;
    colorPlayer.load(BOOT_ANIM_frames, BOOT_ANIM_sizes, BOOT_ANIM_types,
                     BOOT_ANIM_FRAME_COUNT, BOOT_ANIM_FPS,
                     BOOT_ANIM_CROP_X, BOOT_ANIM_CROP_Y, BOOT_ANIM_CROP_W, BOOT_ANIM_CROP_H);
    setNeo(128, 0, 12);
    break;
  case ST_IDLE:
    // [НОВЕ] кольорова анімація через ColorAnimPlayer
    activeIsColorPlayer = true;
    colorPlayer.load(IDLE_ANIM_frames, IDLE_ANIM_sizes, IDLE_ANIM_types,
                     IDLE_ANIM_FRAME_COUNT, IDLE_ANIM_FPS,
                     IDLE_ANIM_CROP_X, IDLE_ANIM_CROP_Y, IDLE_ANIM_CROP_W, IDLE_ANIM_CROP_H);
    setNeo(128, 0, 128);
    break;
  case ST_FOCUS:
    activeIsColorPlayer = true;
    colorPlayer.load(WORK_ANIM_frames, WORK_ANIM_sizes, WORK_ANIM_types,
                     WORK_ANIM_FRAME_COUNT, WORK_ANIM_FPS,
                     WORK_ANIM_CROP_X, WORK_ANIM_CROP_Y, WORK_ANIM_CROP_W, WORK_ANIM_CROP_H);
    setNeo(0, 150, 255);
    break;
  case ST_RELAX:
    activeIsColorPlayer = true;
    colorPlayer.load(HAPPY_ANIM_frames, HAPPY_ANIM_sizes, HAPPY_ANIM_types,
                     HAPPY_ANIM_FRAME_COUNT, HAPPY_ANIM_FPS,
                     HAPPY_ANIM_CROP_X, HAPPY_ANIM_CROP_Y, HAPPY_ANIM_CROP_W, HAPPY_ANIM_CROP_H);
    setNeo(0, 200, 0);
    break;
  case ST_LOVE:
    activeIsColorPlayer = true;
    colorPlayer.load(LOVE_ANIM_frames, LOVE_ANIM_sizes, LOVE_ANIM_types,
                     LOVE_ANIM_FRAME_COUNT, LOVE_ANIM_FPS,
                     LOVE_ANIM_CROP_X, LOVE_ANIM_CROP_Y, LOVE_ANIM_CROP_W, LOVE_ANIM_CROP_H);
    setNeo(255, 0, 150);
    break;
  case ST_ERROR:
    activeIsColorPlayer = true;
    colorPlayer.load(ANGRY_ANIM_frames, ANGRY_ANIM_sizes, ANGRY_ANIM_types,
                     ANGRY_ANIM_FRAME_COUNT, ANGRY_ANIM_FPS,
                     ANGRY_ANIM_CROP_X, ANGRY_ANIM_CROP_Y, ANGRY_ANIM_CROP_W, ANGRY_ANIM_CROP_H);
    setNeo(200, 0, 0);
    break;
  case ST_POMO_WORK:
    // [НОВЕ] повний екран, без анімації — фон+підпис малюємо один раз тут,
    // час+бар прийдуть окремо через #TIME: і оновлюватимуться без перемальовки фону
    drawPomodoroBackground(POMO_WORK_COLOR, "WORK");
    setNeo(56, 189, 248); // той самий #38bdf8
    break;
  case ST_POMO_BREAK:
    drawPomodoroBackground(POMO_BREAK_COLOR, "BREAK");
    setNeo(74, 222, 128); // той самий #4ade80
    break;
  case ST_POMO_LONGBREAK:
    drawPomodoroBackground(POMO_LONGBREAK_COLOR, "LONG BREAK");
    setNeo(99, 102, 241); // той самий #6366f1
    break;
  case ST_CLAUDE:
    drawClaudeScreen();
    if (claudeSubState == 1)
      setNeo(217, 119, 87); // Claude orange (#D97757)
    else if (claudeSubState == 2)
      setNeo(74, 222, 128);
    else if (claudeSubState == 3)
      setNeo(255, 0, 0);
    else
      setNeo(120, 120, 120);
    break;
  }
}

// [НОВЕ] Спільний код для #CLAUDE:/#USAGE: (серійний порт) і /claude-state,
// /claude-usage (WiFi HTTP, див. wifi_manager.h) — один шлях застосування
// оновлення, незалежно від того, звідки воно прийшло.

void applyClaudeState(int sub)
{
  if (pomoLocked)
    return;
  claudeSubState = sub;
  if (sub == 0)
    enterState(ST_IDLE);
  else
    enterState(ST_CLAUDE);
}

void applyClaudeUsage(float fiveHourPct, long fiveHourSecs, float sevenDayPct, long sevenDaySecs)
{
  claudeFiveHourPct = fiveHourPct;
  claudeFiveHourSecsLeft = fiveHourSecs;
  claudeSevenDayPct = sevenDayPct;
  claudeSevenDaySecsLeft = sevenDaySecs;
  drawClaudeUsageBars();
}

// ═════════════════════════════════════════════════════════════════════════════
// Serial — протокол #ANIM:<назва>\n  та  #R\n
// ═════════════════════════════════════════════════════════════════════════════

String packetBuf = "";
bool inPacket = false;

void handlePacket(const String &cmd)
{
  if (cmd == "R")
  {
    delay(50);
    ESP.restart();
    return;
  }

  if (cmd == "VERSION")
  {
    Serial.println("FIRMWARE:" FIRMWARE_VERSION);
    return;
  }

  // [НОВЕ] #TIME:<секунди_залишилось>:<всього_секунд> — оновлює великий час
  // і прогрес-бар. Працює ТІЛЬКИ в режимах ST_POMO_WORK/ST_POMO_BREAK/
  // ST_POMO_LONGBREAK — звичайний #ANIM:focus (без pomo) цю команду просто ігнорує.
  if (cmd.startsWith("TIME:"))
  {
    if (currentState == ST_POMO_WORK || currentState == ST_POMO_BREAK || currentState == ST_POMO_LONGBREAK)
    {
      String rest = cmd.substring(5);
      int sep = rest.indexOf(':');
      int secondsLeft = (sep >= 0) ? rest.substring(0, sep).toInt() : rest.toInt();
      int totalSeconds = (sep >= 0) ? rest.substring(sep + 1).toInt() : 0;
      drawPomodoroTime(secondsLeft, totalSeconds);
    }
    return;
  }

  if (cmd.startsWith("CLAUDE:"))
  {
    if (pomoLocked)
    {
      Serial.println("🔒 pomo locked — CLAUDE ignored");
      return;
    }
    String sub = cmd.substring(7);
    int subCode = -1;
    if (sub == "idle")
      subCode = 0;
    else if (sub == "working")
      subCode = 1;
    else if (sub == "done")
      subCode = 2;
    else if (sub == "waiting")
      subCode = 3;
    if (subCode >= 0)
    {
      applyClaudeState(subCode);
      Serial.print("✅ CLAUDE → ");
      Serial.println(sub);
    }
    return;
  }

  if (cmd.startsWith("USAGE:"))
  {
    // #USAGE:<5hPct>,<5hSecsLeft>,<7dPct>,<7dSecsLeft>\n — секунди до
    // скидання рахує додаток (у нього є реальний час), прошивка лише показує.
    String rest = cmd.substring(6);
    int c1 = rest.indexOf(',');
    int c2 = (c1 >= 0) ? rest.indexOf(',', c1 + 1) : -1;
    int c3 = (c2 >= 0) ? rest.indexOf(',', c2 + 1) : -1;
    if (c1 >= 0 && c2 >= 0 && c3 >= 0)
    {
      applyClaudeUsage(
          rest.substring(0, c1).toFloat(),
          rest.substring(c1 + 1, c2).toInt(),
          rest.substring(c2 + 1, c3).toFloat(),
          rest.substring(c3 + 1).toInt());
    }
    return;
  }

  if (cmd == "WIFI:SCAN")
  {
    Serial.print("WIFI_NETWORKS:");
    Serial.println(wifiScanNetworks());
    return;
  }

  if (cmd.startsWith("WIFI:CONNECT:"))
  {
    // #WIFI:CONNECT:<token>:<ssid>,<password>\n — token first (fixed 32-hex
    // chars, no ambiguous delimiters) so a comma inside the password can't
    // be confused with a field separator; only a comma inside the SSID
    // itself (rare in practice) would still misparse.
    String rest = cmd.substring(13);
    int tokenEnd = rest.indexOf(':');
    if (tokenEnd >= 0)
    {
      String token = rest.substring(0, tokenEnd);
      String ssidAndPass = rest.substring(tokenEnd + 1);
      int commaIdx = ssidAndPass.indexOf(',');
      if (commaIdx >= 0)
      {
        String ssid = ssidAndPass.substring(0, commaIdx);
        String password = ssidAndPass.substring(commaIdx + 1);
        wifiBeginConnect(ssid, password, token);
        Serial.println("✅ WIFI:CONNECT started");
      }
    }
    return;
  }

  if (cmd == "WIFI:STATUS")
  {
    if (WiFi.status() == WL_CONNECTED)
    {
      Serial.print("WIFI_STATUS:connected,");
      Serial.println(WiFi.localIP().toString());
    }
    else
    {
      Serial.println("WIFI_STATUS:disconnected");
    }
    return;
  }

  if (cmd == "WIFI:FORGET")
  {
    wifiForget();
    Serial.println("✅ WIFI:FORGET done");
    return;
  }

  if (cmd.startsWith("ANIM:"))
  {
    String name = cmd.substring(5);

    // Pomo and idle always go through; other window-tracker anims are blocked while pomoLocked.
    bool isPomoAnim = (name == "pomowork" || name == "pomobreak" || name == "pomolongbreak" || name == "idle");
    if (pomoLocked && !isPomoAnim)
    {
      Serial.println("🔒 pomo locked — ANIM ignored");
      return;
    }

    if (name == "startup")
    {
      enterState(ST_STARTUP);
      Serial.println("✅ ANIM → startup");
    }
    else if (name == "idle")
    {
      enterState(ST_IDLE);
      Serial.println("✅ ANIM → idle");
    }
    else if (name == "focus")
    {
      enterState(ST_FOCUS);
      Serial.println("✅ ANIM → focus");
    }
    else if (name == "relax")
    {
      enterState(ST_RELAX);
      Serial.println("✅ ANIM → relax");
    }
    else if (name == "love")
    {
      enterState(ST_LOVE);
      Serial.println("✅ ANIM → love");
    }
    else if (name == "error")
    {
      enterState(ST_ERROR);
      Serial.println("✅ ANIM → error");
    }
    else if (name == "pomowork")
    {
      enterState(ST_POMO_WORK);
      Serial.println("✅ ANIM → pomowork (повний екран)");
    }
    else if (name == "pomobreak")
    {
      enterState(ST_POMO_BREAK);
      Serial.println("✅ ANIM → pomobreak (повний екран)");
    }
    else if (name == "pomolongbreak")
    {
      enterState(ST_POMO_LONGBREAK);
      Serial.println("✅ ANIM → pomolongbreak (повний екран)");
    }
    else
    {
      Serial.print("⚠️ Невідома анімація: ");
      Serial.println(name);
    }
  }
  else
  {
    Serial.print("⚠️ Невідома команда: #");
    Serial.println(cmd);
  }
}

void readSerial()
{
  while (Serial.available())
  {
    char c = (char)Serial.read();
    if (c == '#')
    {
      inPacket = true;
      packetBuf = "";
      continue;
    }
    if (!inPacket)
      continue;
    if (c == '\n')
    {
      inPacket = false;
      handlePacket(packetBuf);
      packetBuf = "";
      continue;
    }
    // Was 32 — bumped to fit #WIFI:CONNECT:<token>:<ssid>,<password> (SSID up
    // to 32 bytes + WPA2 password up to 64 + a 32-char hex token + prefixes).
    if (packetBuf.length() < 256)
      packetBuf += c;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// setup() / loop()
// ═════════════════════════════════════════════════════════════════════════════

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

  // [НОВЕ] Pomodoro / Claude Code full-screen — без анімації, нічого тікати не потрібно
  if (currentState == ST_POMO_WORK || currentState == ST_POMO_BREAK || currentState == ST_POMO_LONGBREAK || currentState == ST_CLAUDE)
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