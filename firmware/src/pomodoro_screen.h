#pragma once

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
