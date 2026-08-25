#pragma once

// ═════════════════════════════════════════════════════════════════════════════
// MonoCanvas — renders a 1bpp Adafruit_GFX bitmap (MSB first) in a given
// color, scaled up to the real screen through a sprite buffer
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

  // bitmap: 1bpp, MSB first, byteWidth bytes per row (as in idle01.h/focus01.h/...)
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
// AnimPlayer — a universal player for xxx_frames[] + xxx_FRAME_COUNT/FPS
// (the file structure is unchanged — same format as idle01.h etc.)
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
    _drawFrame(0); // show the first frame immediately, don't wait for the timer
  }

  // Returns true if this was the last frame of a one-shot animation
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
// ColorAnimPlayer — the same decode algorithm as convert_animation.mjs:
// frame 0 = full RLE keyframe, frames 1+ = only the changed pixels (delta),
// SKIP = frame identical to the previous one (nothing to redraw).
//
// Unlike MonoCanvas (128×64, scaled up), this animation is drawn directly at
// its own screen coordinates (CROP_X/Y/W/H from the header) — because it's
// already full-color and at its "native" resolution, no scaling needed.
// ═════════════════════════════════════════════════════════════════════════════

class ColorAnimPlayer
{
public:
  // Call once in setup() — allocates a PSRAM buffer sized for the largest crop
  bool begin()
  {
    _buf = (uint16_t *)ps_malloc(COLOR_MAX_PIXELS * sizeof(uint16_t));
    if (_buf == nullptr)
      _buf = (uint16_t *)malloc(COLOR_MAX_PIXELS * sizeof(uint16_t));
    return _buf != nullptr;
  }

  // cropX/cropY/cropW/cropH — coordinates relative to the same 128×64
  // "virtual" Rive canvas as the mono animations. Scaling and centering onto
  // the real screen uses the same OLED_SCALE/OLED_DRAW_X/Y as those do — so
  // both content types look consistent in the same "space".
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

  // loop=false: stops on the last frame and returns true (once) — needed for
  // the startup animation, which has to hand off control to idle.
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
  int32_t _drawX = 0, _drawY = 0;  // real screen coordinates of the top-left corner
  uint16_t _cropW = 0, _cropH = 0; // size in "virtual" pixels (before scaling)
  unsigned long _lastMs = 0;

  void _renderFrame(uint16_t idx)
  {
    uint8_t type = pgm_read_byte(&_types[idx]);
    if (type == 2)
      return; // SKIP — the screen already shows the right frame

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

  // Scaled blit via horizontal runs of the same color — same technique as
  // MonoCanvas::present(), just with real colors here (RGB565) instead of
  // only background/foreground.
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
