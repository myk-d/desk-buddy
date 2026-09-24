#pragma once

// ═════════════════════════════════════════════════════════════════════════════
// Pins (verified on the board)
// ═════════════════════════════════════════════════════════════════════════════

#define PIN_BACKLIGHT 21
#define PIN_NEOPIXEL 48
#define BAUD_RATE 115200

// ═════════════════════════════════════════════════════════════════════════════
// LovyanGFX — ILI9341 320×240 SPI
// ═════════════════════════════════════════════════════════════════════════════

class LGFX_BeakBuddy : public lgfx::LGFX_Device
{
  lgfx::Panel_ILI9341 _panel;
  lgfx::Bus_SPI _bus;

public:
  LGFX_BeakBuddy()
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

LGFX_BeakBuddy lcd;
Adafruit_NeoPixel pixels(1, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);

// ── 128×64 "virtual" canvas — scaled up to the real screen ─────────────────
#define OLED_W 128
#define OLED_H 64
#define OLED_SCALE 2
const int OLED_DRAW_W = OLED_W * OLED_SCALE;
const int OLED_DRAW_H = OLED_H * OLED_SCALE;
const int OLED_DRAW_X = (320 - OLED_DRAW_W) / 2;
const int OLED_DRAW_Y = (240 - OLED_DRAW_H) / 2;

// ── Full-screen Pomodoro mode — no animation at all ─────────────────────────
// Colors match the React app: #38bdf8 (work), #4ade80 (break)
#define POMO_WORK_COLOR 0x3DFF
#define POMO_BREAK_COLOR 0x4EF0
#define POMO_LONGBREAK_COLOR 0x633D  // indigo — same #6366f1 as React PHASE_META.longBreak

// ── Claude Code full-screen status — its own screen, no animation ──────────
// Design built around Claude's brand color (terracotta/orange #D97757).
#define CLAUDE_WORKING_COLOR 0xD3AB  // Claude orange (#D97757)
#define CLAUDE_DONE_COLOR 0x4EF0     // same green as pomo break
#define CLAUDE_WAITING_COLOR 0xF800  // bright red
#define CLAUDE_THINKING_COLOR 0xAABE // purple (same brand #a855f7 as the app) — between UserPromptSubmit and the first tool call
#define CLAUDE_NEUTRAL_COLOR 0x39C7  // gray — placeholder while there's no sub-state yet
#define CLAUDE_BG_DARK 0x0862        // near-black screen background
#define CLAUDE_CARD_BG 0x18C4        // stat card background
#define CLAUDE_TRACK_COLOR 0x2965    // progress bar track background
#define CLAUDE_TEXT_MUTED 0x8430     // muted gray text
#define CLAUDE_PCT_5H_COLOR 0xD3AB   // session ring (5h) fallback — orange, used only while there's no usage % yet to grade
#define CLAUDE_PCT_7D_COLOR 0xF9F0   // weekly ring (7d) — pink, fixed regardless of usage level

// Session-ring severity grading — same three tiers/thresholds as the desktop
// app's pctColor() (DevicePage.tsx): <70% / 70-89% / >=90%. Only the session
// (5h) ring and its NeoPixel blink use these; the weekly ring stays the fixed
// pink above.
#define CLAUDE_PCT_OK_COLOR 0x262B   // green-500 (#22c55e)
#define CLAUDE_PCT_MED_COLOR 0xFDE4  // amber-400 (#fbbf24)
#define CLAUDE_PCT_HIGH_COLOR 0xFB8E // red-400 (#f87171)

// ── Buffer for colored (RGB565 delta+RLE) animations ────────────────────────
// Must match FIRMWARE_CROP_W_MAX/H_MAX in convert_animation.mjs.
#define COLOR_CROP_W_MAX 310
#define COLOR_CROP_H_MAX 160
#define COLOR_MAX_PIXELS (COLOR_CROP_W_MAX * COLOR_CROP_H_MAX)
