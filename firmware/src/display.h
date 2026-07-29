#pragma once

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
