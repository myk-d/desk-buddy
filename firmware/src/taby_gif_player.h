#pragma once

// Plays the Taby character GIFs straight off LittleFS (data/taby/<id>.gif,
// uploaded via `pio run --target uploadfs`) using bitbank2/AnimatedGIF.
// Kept at their original 280x456 resolution on disk (no flash-size pressure
// now that they live in a filesystem partition, not PROGMEM) — downscaled
// 2x by nearest-neighbor sampling right in the draw callback, so no extra
// frame buffer is needed. 280x456 -> 140x228, centered on the 320x240 panel.

#include <AnimatedGIF.h>
#include <LittleFS.h>

AnimatedGIF tabyGif;
File tabyGifFile;

const int TABY_DRAW_SCALE = 2; // nearest-neighbor downscale factor
const int TABY_DRAW_W = 280 / TABY_DRAW_SCALE;  // 140
const int TABY_DRAW_H = 456 / TABY_DRAW_SCALE;  // 228
const int TABY_DRAW_X = (320 - TABY_DRAW_W) / 2; // 90
const int TABY_DRAW_Y = (240 - TABY_DRAW_H) / 2; // 6

void *GIFOpenFile(const char *fname, int32_t *pSize)
{
  tabyGifFile = LittleFS.open(fname, "r");
  if (!tabyGifFile)
    return nullptr;
  *pSize = tabyGifFile.size();
  return (void *)&tabyGifFile;
}

void GIFCloseFile(void *pHandle)
{
  File *f = static_cast<File *>(pHandle);
  if (f != nullptr)
    f->close();
}

int32_t GIFReadFile(GIFFILE *pFile, uint8_t *pBuf, int32_t iLen)
{
  int32_t iBytesRead = iLen;
  File *f = static_cast<File *>(pFile->fHandle);
  if ((pFile->iSize - pFile->iPos) < iLen)
    iBytesRead = pFile->iSize - pFile->iPos;
  if (iBytesRead <= 0)
    return 0;
  iBytesRead = (int32_t)f->read(pBuf, iBytesRead);
  pFile->iPos += iBytesRead;
  return iBytesRead;
}

int32_t GIFSeekFile(GIFFILE *pFile, int32_t iPosition)
{
  File *f = static_cast<File *>(pFile->fHandle);
  f->seek(iPosition);
  pFile->iPos = iPosition;
  return iPosition;
}

// One decoded (and already downscaled) scanline worth of RGB565 pixels.
// TABY_DRAW_W (140) is the ceiling — real source rows are at most 280px wide.
static uint16_t tabyScanline[TABY_DRAW_W];

void GIFDraw(GIFDRAW *pDraw)
{
  if (pDraw->y % TABY_DRAW_SCALE != 0)
    return; // row-downscale: only every Nth source row is actually drawn

  uint8_t *s = pDraw->pPixels;
  uint16_t *usPalette = pDraw->pPalette;
  int srcWidth = pDraw->iWidth;
  int y = TABY_DRAW_Y + (pDraw->iY + pDraw->y) / TABY_DRAW_SCALE;
  int destX0 = TABY_DRAW_X + pDraw->iX / TABY_DRAW_SCALE;

  // Frames with disposal method 2 restore to the background color first —
  // same background-restore-before-draw handling as the library's own
  // SD-card example.
  if (pDraw->ucDisposalMethod == 2)
  {
    for (int x = 0; x < srcWidth; x++)
      if (s[x] == pDraw->ucTransparent)
        s[x] = pDraw->ucBackground;
    pDraw->ucHasTransparency = 0;
  }

  if (pDraw->ucHasTransparency)
  {
    // Column-downscale + transparency in one pass: walk in steps of
    // TABY_DRAW_SCALE, batching contiguous opaque runs into pushImage calls
    // and skipping transparent ones (leaving whatever's already on screen —
    // enterState()'s fillScreen(0x0000) already cleared it to black once).
    int x = 0;
    while (x < srcWidth)
    {
      int dstStart = x / TABY_DRAW_SCALE;
      int count = 0;
      while (x < srcWidth && s[x] != pDraw->ucTransparent)
      {
        tabyScanline[count++] = usPalette[s[x]];
        x += TABY_DRAW_SCALE;
      }
      if (count)
        lcd.pushImage(destX0 + dstStart, y, count, 1, tabyScanline);
      while (x < srcWidth && s[x] == pDraw->ucTransparent)
        x += TABY_DRAW_SCALE;
    }
  }
  else
  {
    int count = 0;
    for (int x = 0; x < srcWidth; x += TABY_DRAW_SCALE)
      tabyScanline[count++] = usPalette[s[x]];
    lcd.pushImage(destX0, y, count, 1, tabyScanline);
  }
}

class TabyGifPlayer
{
public:
  bool load(const char *id)
  {
    close();
    snprintf(_path, sizeof(_path), "/taby/%s.gif", id);
    if (!tabyGif.open(_path, GIFOpenFile, GIFCloseFile, GIFReadFile, GIFSeekFile, GIFDraw))
      return false;
    _active = true;
    _lastMs = millis();
    _nextDelayMs = 0;
    return true;
  }

  void close()
  {
    if (_active)
    {
      tabyGif.close();
      _active = false;
    }
  }

  // Non-blocking — called every loop() iteration while ST_TABY is current.
  // Returns true the moment a full playthrough just completed (one-shot
  // reaction finished, or a looping animation wrapped back to frame 0).
  bool tick(bool loop)
  {
    if (!_active)
      return false;
    if (millis() - _lastMs < (unsigned long)_nextDelayMs)
      return false;
    _lastMs = millis();
    int delayMs = 0;
    int more = tabyGif.playFrame(false, &delayMs, nullptr);
    _nextDelayMs = delayMs;
    if (more)
      return false;

    // Last frame of this cycle just got drawn.
    if (loop)
    {
      char path[48];
      strncpy(path, _path, sizeof(path));
      tabyGif.close();
      tabyGif.open(path, GIFOpenFile, GIFCloseFile, GIFReadFile, GIFSeekFile, GIFDraw);
    }
    else
    {
      close();
    }
    return true;
  }

private:
  bool _active = false;
  char _path[48] = "";
  unsigned long _lastMs = 0;
  int _nextDelayMs = 0;
};

TabyGifPlayer tabyPlayer;
