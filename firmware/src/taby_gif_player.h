#pragma once

// Plays the Taby character GIFs straight off LittleFS (data/taby/<id>.gif,
// uploaded via `pio run --target uploadfs`) using bitbank2/AnimatedGIF.
//
// Each frame is decoded at FULL native resolution (280x456) into a PSRAM
// sprite — same row-by-row GIFDraw pattern as the library's own SD-card
// example, just targeting a sprite instead of the panel directly — then the
// whole sprite is blitted to the real screen in one shot via LovyanGFX's
// pushRotateZoom(), which rotates 90° (the source GIFs come out sideways on
// our panel as-is, confirmed against the real device) and scales down to
// fit (280x456 -> roughly 228x140 displayed, zoom 0.5) in hardware.
//
// An earlier version tried to downscale by point-sampling every 2nd row/
// column directly in GIFDraw to save the sprite's RAM — don't do that
// again: skipping pixels during a delta-GIF decode means any changed pixel
// that happens to land on a skipped row/column never gets drawn, leaving
// stale/ghost pixels and occasional stray colors that only clear once a
// *sampled* pixel nearby happens to change. Decoding the full frame and
// scaling as a single final blit has none of that — every row/column is
// processed, exactly like the reference implementation.

#include <AnimatedGIF.h>
#include <LittleFS.h>

AnimatedGIF tabyGif;
File tabyGifFile;

const int TABY_SRC_W = 280;  // GIF's own native canvas
const int TABY_SRC_H = 456;
const float TABY_ZOOM = 0.5f;       // displayed size after rotation: ~228x140
const float TABY_ROTATE_DEG = -90;  // counterclockwise — flip the sign if it ever comes out backwards

LGFX_Sprite tabySprite(&lcd);

bool tabySpriteBegin()
{
  tabySprite.setColorDepth(16);
  tabySprite.setPsram(true);
  tabySprite.setPivot(TABY_SRC_W / 2.0f, TABY_SRC_H / 2.0f); // rotate/zoom around the frame's center
  return tabySprite.createSprite(TABY_SRC_W, TABY_SRC_H) != nullptr;
}

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

// One decoded scanline worth of RGB565 pixels, at native (unscaled) width.
static uint16_t tabyLineBuf[TABY_SRC_W];

void GIFDraw(GIFDRAW *pDraw)
{
  uint8_t *s = pDraw->pPixels;
  uint16_t *usPalette = pDraw->pPalette;
  int iWidth = pDraw->iWidth;
  int y = pDraw->iY + pDraw->y;

  // Frames with disposal method 2 restore to the background color first —
  // same background-restore-before-draw handling as the library's own
  // SD-card example.
  if (pDraw->ucDisposalMethod == 2)
  {
    for (int x = 0; x < iWidth; x++)
      if (s[x] == pDraw->ucTransparent)
        s[x] = pDraw->ucBackground;
    pDraw->ucHasTransparency = 0;
  }

  if (pDraw->ucHasTransparency)
  {
    // Batch contiguous opaque runs into pushImage calls, skip transparent
    // ones (leaving whatever's already in the sprite from a previous frame
    // — exactly what a delta-GIF frame expects).
    int x = 0;
    while (x < iWidth)
    {
      int start = x;
      int count = 0;
      while (x < iWidth && s[x] != pDraw->ucTransparent)
      {
        tabyLineBuf[count++] = usPalette[s[x]];
        x++;
      }
      if (count)
        tabySprite.pushImage(pDraw->iX + start, y, count, 1, tabyLineBuf);
      while (x < iWidth && s[x] == pDraw->ucTransparent)
        x++;
    }
  }
  else
  {
    for (int x = 0; x < iWidth; x++)
      tabyLineBuf[x] = usPalette[s[x]];
    tabySprite.pushImage(pDraw->iX, y, iWidth, 1, tabyLineBuf);
  }
}

class TabyGifPlayer
{
public:
  bool load(const char *id)
  {
    close();
    // tabySprite is shared across every animation — without this, a new
    // GIF whose first frame doesn't cover the full 280x456 canvas leaves
    // the *previous* animation's leftover pixels showing in the uncovered
    // area, which reads as random/"inverted" colors bleeding in.
    tabySprite.fillScreen(0x0000);
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

    // The frame GIFDraw just decoded into tabySprite is complete — blit it,
    // rotated+scaled, in one shot.
    tabySprite.pushRotateZoom(160, 120, TABY_ROTATE_DEG, TABY_ZOOM, TABY_ZOOM);

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
