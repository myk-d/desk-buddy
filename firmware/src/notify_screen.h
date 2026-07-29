#pragma once

// [НОВЕ] Generic ambient-status screen (/notify) — той самий візуальний
// підхід, що й Claude Code екран (кольорова смужка + повідомлення), але не
// прив'язаний до жодної конкретної інтеграції. Автоматично повертається в
// idle через notifyDurationMs — той самий підхід, що й pollClaudeDoneTimeout().

#define NOTIFY_BG_DARK 0x0862 // той самий колір, що й CLAUDE_BG_DARK

void drawNotifyScreen()
{
  lcd.fillScreen(NOTIFY_BG_DARK);
  lcd.fillRect(0, 0, 320, 30, notifyColor);
  lcd.setTextSize(1);
  lcd.setTextColor(0x0000, notifyColor); // чорний текст — читається на будь-якому яскравому кольорі смужки
  lcd.setCursor(10, 11);
  lcd.print(notifyTitle);

  // Просте перенесення рядків по словах — повідомлення можуть бути довшими
  // за один рядок (майбутні нагадування з Task/Calendar), а Adafruit_GFX
  // сам по собі рядки не переносить.
  lcd.setTextSize(2);
  lcd.setTextColor(0xFFFF, NOTIFY_BG_DARK);
  const int marginX = 14;
  const int maxWidth = 320 - marginX * 2;
  const int charW = 6 * 2; // базова ширина символу (6px) * textSize
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
