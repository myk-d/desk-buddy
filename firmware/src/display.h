#pragma once

// ═════════════════════════════════════════════════════════════════════════════
// Pins (verified on the board)
// ═════════════════════════════════════════════════════════════════════════════

#define PIN_BACKLIGHT 21
#define PIN_NEOPIXEL 48
#define BAUD_RATE 115200

// AHT20+BMP280 climate sensor (I2C) — picked to avoid the SPI bus (10-14),
// NeoPixel (48), backlight (21), native-USB-CDC (19-20), and the strapping
// pins (0/3/45/46). Not yet verified against the physical board (sensor was
// still in transit as of writing) — check these are actually broken out and
// free before wiring, and update here if not.
#define PIN_I2C_SDA 4
#define PIN_I2C_SCL 5

// XPT2046 resistive touch, on the same display module — wired to its own
// 5 GPIOs entirely (not sharing the display's SPI lines), since female-
// female jumpers can't tap an already-occupied pin without soldering.
// Software/bit-banged SPI (spi_host=-1 in display.h), so these can be any
// free GPIOs, not tied to a hardware SPI peripheral. Picked to avoid
// everything above plus octal PSRAM's internal GPIO33-37 (this board has
// qio_opi PSRAM — those aren't broken out on the header at all for that
// reason).
#define PIN_TOUCH_CLK 6
#define PIN_TOUCH_DIN 7
#define PIN_TOUCH_DO 8
#define PIN_TOUCH_CS 1
#define PIN_TOUCH_IRQ 2

// ═════════════════════════════════════════════════════════════════════════════
// LovyanGFX — ILI9341 320×240 SPI
// ═════════════════════════════════════════════════════════════════════════════

class LGFX_BeakBuddy : public lgfx::LGFX_Device
{
  lgfx::Panel_ILI9341 _panel;
  lgfx::Bus_SPI _bus;
  lgfx::Touch_XPT2046 _touch;

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

    // XPT2046 on its own independent, fully separate pins — spi_host=-1
    // makes LovyanGFX bit-bang SPI over plain GPIOs instead of using a
    // hardware SPI peripheral, so these don't need to be on any particular
    // bus. x_min/x_max/y_min/y_max/offset_rotation calibrated against the
    // real board (4-corner raw touch readings, solved against LovyanGFX's
    // own setCalibrate()/convertRawXY() formulas — see the conversation
    // around 2026-11-23) — don't hand-tune these without redoing that fit,
    // small tweaks in isolation usually make it worse, not better.
    auto t = _touch.config();
    t.bus_shared = false;
    t.spi_host = -1;
    t.pin_sclk = PIN_TOUCH_CLK;
    t.pin_mosi = PIN_TOUCH_DIN;
    t.pin_miso = PIN_TOUCH_DO;
    t.pin_cs = PIN_TOUCH_CS;
    t.pin_int = PIN_TOUCH_IRQ;
    t.freq = 1000000;
    t.x_min = 346;
    t.x_max = 3770;
    t.y_min = 181;
    t.y_max = 3675;
    t.offset_rotation = 6;
    _touch.config(t);
    _panel.setTouch(&_touch);

    setPanel(&_panel);
  }
};

LGFX_BeakBuddy lcd;
Adafruit_NeoPixel pixels(1, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);

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

