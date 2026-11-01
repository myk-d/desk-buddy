#pragma once

// Plays the Taby character GIFs straight off LittleFS (data/taby/<id>.gif,
// uploaded via `pio run --target uploadfs`) using bitbank2/AnimatedGIF.
// Kept at their original 280x456 resolution on disk (no flash-size pressure
// now that they live in a filesystem partition, not PROGMEM) — downscaled
// 2x by nearest-neighbor sampling right in the draw callback, so no extra
// frame buffer is needed.
//
// The source GIFs are portrait (280x456) but come out rotated 90° on our
// panel as-is (confirmed against the real device) — rotated 90°
// counterclockwise here to compensate, which also turns the on-screen
// footprint landscape: 456x280 scaled down -> 228x140, centered.

#include <AnimatedGIF.h>
#include <LittleFS.h>

AnimatedGIF tabyGif;
File tabyGifFile;

const int TABY_DRAW_SCALE = 2; // nearest-neighbor downscale factor
const int TABY_SRC_W = 280;  // GIF's own native canvas, pre-rotation
const int TABY_SRC_H = 456;
const int TABY_DRAW_W = TABY_SRC_H / TABY_DRAW_SCALE; // 228 — swapped: rotating 90° swaps width/height
const int TABY_DRAW_H = TABY_SRC_W / TABY_DRAW_SCALE; // 140
const int TABY_DRAW_X = (320 - TABY_DRAW_W) / 2; // 46
const int TABY_DRAW_Y = (240 - TABY_DRAW_H) / 2; // 50

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

// One decoded (and already downscaled) column worth of RGB565 pixels — each
// GIFDraw call is one source scanline (fixed src Y), which after a 90°
// rotation becomes one destination COLUMN (fixed dest X), not a row.
// TABY_SRC_W/SCALE (140) is the ceiling — real source rows are at most
// 280px wide.
static uint16_t tabyScanline[TABY_SRC_W / TABY_DRAW_SCALE + 1];

// 90° CCW rotation: for a source pixel at (srcX, srcY) in the TABY_SRC_W x
// TABY_SRC_H canvas, the rotated+scaled destination is
//   destX = TABY_DRAW_X + srcY / SCALE                (constant per GIFDraw call)
//   destY = TABY_DRAW_Y + (TABY_SRC_W - 1 - srcX) / SCALE   (DEcreases as srcX increases)
// so a whole scanline (increasing srcX) maps to one column, top-to-bottom
// in REVERSE srcX order — everything below walks srcX from high to low to
// build tabyScanline in increasing-destY order, exactly what
// pushImage(w=1, h=N) expects to paint top-to-bottom.
void GIFDraw(GIFDRAW *pDraw)
{
  if (pDraw->y % TABY_DRAW_SCALE != 0)
    return; // row-downscale: only every Nth source row is actually drawn

  uint8_t *s = pDraw->pPixels;
  uint16_t *usPalette = pDraw->pPalette;
  int srcWidth = pDraw->iWidth;
  int srcY = pDraw->iY + pDraw->y;
  int destX = TABY_DRAW_X + srcY / TABY_DRAW_SCALE;

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
    int x = srcWidth - 1;
    while (x >= 0)
    {
      int count = 0;
      int runStartDestY = -1;
      while (x >= 0 && s[x] != pDraw->ucTransparent)
      {
        int srcX = pDraw->iX + x;
        int destY = TABY_DRAW_Y + (TABY_SRC_W - 1 - srcX) / TABY_DRAW_SCALE;
        if (count == 0)
          runStartDestY = destY; // smallest destY of this run — pushImage's top
        tabyScanline[count++] = usPalette[s[x]];
        x -= TABY_DRAW_SCALE;
      }
      if (count)
        lcd.pushImage(destX, runStartDestY, 1, count, tabyScanline);
      while (x >= 0 && s[x] == pDraw->ucTransparent)
        x -= TABY_DRAW_SCALE;
    }
  }
  else
  {
    int count = 0;
    for (int x = srcWidth - 1; x >= 0; x -= TABY_DRAW_SCALE)
      tabyScanline[count++] = usPalette[s[x]];
    int lastSrcX = pDraw->iX + srcWidth - 1;
    int destYStart = TABY_DRAW_Y + (TABY_SRC_W - 1 - lastSrcX) / TABY_DRAW_SCALE;
    lcd.pushImage(destX, destYStart, 1, count, tabyScanline);
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
