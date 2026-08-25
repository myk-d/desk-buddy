#pragma once

// Generic ambient-status screen (/notify) — the same visual approach as the
// Claude Code screen (colored strip + message), but not tied to any specific
// integration. Auto-reverts to idle after notifyDurationMs — same pattern as
// pollClaudeDoneTimeout().

#define NOTIFY_BG_DARK 0x0862 // same color as CLAUDE_BG_DARK

void drawNotifyScreen()
{
  lcd.fillScreen(NOTIFY_BG_DARK);
  lcd.fillRect(0, 0, 320, 30, notifyColor);
  lcd.setTextSize(1);
  lcd.setTextColor(0x0000, notifyColor); // black text — readable against any bright strip color
  lcd.setCursor(10, 11);
  lcd.print(notifyTitle);

  // Simple word-wrap — messages can be longer than one line (future
  // reminders from Task/Calendar), and Adafruit_GFX doesn't wrap on its own.
  lcd.setTextSize(2);
  lcd.setTextColor(0xFFFF, NOTIFY_BG_DARK);
  const int marginX = 14;
  const int maxWidth = 320 - marginX * 2;
  const int charW = 6 * 2; // base character width (6px) * textSize
  const int maxCharsPerLine = maxWidth / charW;

  int y = 50;
  int start = 0;
  int len = notifyMessage.length();
  while (start < len)
  {
    int end = start + maxCharsPerLine;
    if (end < len)
    {
      int lastSpace = -1;
      for (int i = start; i < end; i++)
        if (notifyMessage[i] == ' ')
          lastSpace = i;
      if (lastSpace > start)
        end = lastSpace;
    }
    else
    {
      end = len;
    }
    lcd.setCursor(marginX, y);
    lcd.print(notifyMessage.substring(start, end));
    y += 26;
    start = end;
    while (start < len && notifyMessage[start] == ' ')
      start++;
  }
}

void applyNotify(const String &title, const String &message, uint16_t color, unsigned long durationMs)
{
  if (pomoLocked)
    return;
  notifyTitle = title;
  notifyMessage = message;
  notifyColor = color;
  notifyDurationMs = durationMs;
  notifyAtMs = millis();
  enterState(ST_NOTIFY);
}

// Non-blocking — called every loop() iteration, same pattern as
// pollClaudeDoneTimeout().
void pollNotifyTimeout()
{
  if (currentState == ST_NOTIFY && notifyAtMs != 0 && millis() - notifyAtMs > notifyDurationMs)
  {
    notifyAtMs = 0;
    enterState(ST_IDLE);
  }
}
