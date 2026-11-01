#pragma once

// AHT20+BMP280 climate screen — three cards (temp/humidity/pressure), same
// dark-card visual language as claude_screen.h's ring cards. Pops up on its
// own every SENSOR_READ_INTERVAL_MS (5 min, pollSensorAutoShow()) and can also be
// triggered manually (#ANIM:sensor); either way it shows for SENSOR_DISPLAY_MS
// then reverts to idle on its own (pollSensorTimeout()) — a glance-and-go
// screen, not a sticky mode. Entering it (drawSensorScreen, via enterState)
// always takes one fresh reading regardless of the 5-minute timer;
// pollSensorRead() then only re-reads once SENSOR_READ_INTERVAL_MS has
// elapsed and the screen is still up — no point polling I2C in the
// background for a screen nobody's looking at.

#include <Wire.h>
#include <Adafruit_AHTX0.h>
#include <Adafruit_BMP280.h>

Adafruit_AHTX0 aht;
Adafruit_BMP280 bmp;

// Distinct accent colors per quantity (not severity-graded like the Claude
// ring — these are just different physical measurements, nothing to grade).
#define SENSOR_TEMP_COLOR 0xFC87     // orange-400 (#fb923c)
#define SENSOR_HUMIDITY_COLOR 0x3DFF // same sky blue as pomo-work (#38bdf8) — water association
#define SENSOR_PRESSURE_COLOR 0xA45F // violet-400 (#a78bfa)

// Called once from setup(). Returns false (and leaves sensorAvailable false)
// if either chip doesn't ack on the bus — lets drawSensorReadings() show a
// clear "not found" message instead of printing NaN forever.
bool sensorsBegin()
{
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  bool ahtOk = aht.begin();
  // BMP280 breakouts ship wired to either 0x76 or 0x77 depending on the
  // module's SDO strap — try both rather than hardcoding one.
  bool bmpOk = bmp.begin(0x76) || bmp.begin(0x77);
  sensorAvailable = ahtOk && bmpOk;
  if (!sensorAvailable)
    Serial.printf("⚠️ Climate sensor init failed (AHT20:%d BMP280:%d) — check wiring and PIN_I2C_SDA/PIN_I2C_SCL in display.h\n", ahtOk, bmpOk);
  else
    lastSensorAutoShowMs = millis(); // first auto-show waits one full interval after boot
  return sensorAvailable;
}

void readSensorNow()
{
  if (!sensorAvailable)
    return;
  sensors_event_t humidityEvent, tempEvent;
  aht.getEvent(&humidityEvent, &tempEvent);
  sensorTempC = tempEvent.temperature;
  sensorHumidityPct = humidityEvent.relative_humidity;
  sensorPressureHpa = bmp.readPressure() / 100.0f; // Pa -> hPa
  lastSensorReadMs = millis();
}

void drawSensorCard(int x, int y, int w, int h, const char *label, const char *valueStr, const char *unitStr, uint16_t accentColor)
{
  lcd.fillRoundRect(x, y, w, h, 10, CLAUDE_CARD_BG);

  const float labelSize = 1.2f;
  lcd.setTextSize(labelSize);
  lcd.setTextColor(CLAUDE_TEXT_MUTED, CLAUDE_CARD_BG);
  int labelW = (int)(strlen(label) * 6 * labelSize);
  lcd.setCursor(x + (w - labelW) / 2, y + 12);
  lcd.print(label);

  const float valueSize = 2.6f;
  lcd.setTextSize(valueSize);
  lcd.setTextColor(accentColor, CLAUDE_CARD_BG);
  int valueW = (int)(strlen(valueStr) * 6 * valueSize);
  lcd.setCursor(x + (w - valueW) / 2, y + h / 2 - (int)(8 * valueSize) / 2);
  lcd.print(valueStr);

  const float unitSize = 1.3f;
  lcd.setTextSize(unitSize);
  lcd.setTextColor(CLAUDE_TEXT_MUTED, CLAUDE_CARD_BG);
  int unitW = (int)(strlen(unitStr) * 6 * unitSize);
  lcd.setCursor(x + (w - unitW) / 2, y + h - 30);
  lcd.print(unitStr);
}

void drawSensorReadings()
{
  if (currentState != ST_SENSOR)
    return;
  lcd.fillRect(0, 30, 320, 210, CLAUDE_BG_DARK);

  if (!sensorAvailable)
  {
    const char *msg = "Sensor not found";
    lcd.setTextSize(1.5f);
    lcd.setTextColor(CLAUDE_TEXT_MUTED, CLAUDE_BG_DARK);
    int msgW = (int)(strlen(msg) * 6 * 1.5f);
    lcd.setCursor((320 - msgW) / 2, 110);
    lcd.print(msg);
    return;
  }

  char tempBuf[8], humBuf[8], pressBuf[8];
  snprintf(tempBuf, sizeof(tempBuf), "%.1f", sensorTempC);
  snprintf(humBuf, sizeof(humBuf), "%.1f", sensorHumidityPct);
  snprintf(pressBuf, sizeof(pressBuf), "%.0f", sensorPressureHpa);

  drawSensorCard(8, 38, 96, 198, "TEMP", tempBuf, "C", SENSOR_TEMP_COLOR);
  drawSensorCard(112, 38, 96, 198, "HUMIDITY", humBuf, "%", SENSOR_HUMIDITY_COLOR);
  drawSensorCard(216, 38, 96, 198, "PRESSURE", pressBuf, "hPa", SENSOR_PRESSURE_COLOR);
}

void drawSensorScreen()
{
  readSensorNow(); // always fresh the moment the screen is (re)entered
  sensorShownAtMs = millis(); // starts (or restarts) the auto-revert-to-idle countdown
  lcd.fillScreen(CLAUDE_BG_DARK);
  lcd.fillRect(0, 0, 320, 30, CLAUDE_NEUTRAL_COLOR);
  lcd.setTextSize(1);
  lcd.setTextColor(0x0000, CLAUDE_NEUTRAL_COLOR);
  lcd.setCursor(10, 11);
  lcd.print("CLIMATE");
  drawSensorReadings();
}

// Entry point for both the manual #ANIM:sensor command and the automatic
// popup below — captures whatever was showing first, so pollSensorTimeout()
// can return to it instead of always dropping to idle (e.g. interrupting an
// active ST_CLAUDE limits screen shouldn't lose it).
void showSensorScreen()
{
  if (currentState == ST_SENSOR)
    return; // already showing — don't clobber the saved "before" state
  stateBeforeSensor = currentState;
  enterState(ST_SENSOR);
}

// Non-blocking — called every loop() iteration, same pattern as
// pollClaudeDoneTimeout()/pollNotifyTimeout(). Climate is a glance-and-go
// screen: it reverts on its own after SENSOR_DISPLAY_MS to whatever was
// showing before it, rather than always dropping to idle.
void pollSensorTimeout()
{
  if (currentState == ST_SENSOR && sensorShownAtMs != 0 && millis() - sensorShownAtMs > SENSOR_DISPLAY_MS)
  {
    sensorShownAtMs = 0;
    enterState(stateBeforeSensor);
  }
}

// Non-blocking — called every loop() iteration. Pops Climate up on its own
// every SENSOR_READ_INTERVAL_MS (5 min), not just when manually triggered
// via #ANIM:sensor. Skips while something else actually matters on screen
// (Pomodoro, Claude Code, Notify, startup, or Climate already showing) so it
// never interrupts those — but does interrupt the idle/window-tracker
// animations (idle/focus/relax/love/error), the same way those already
// interrupt each other.
void pollSensorAutoShow()
{
  if (!sensorAvailable || pomoLocked)
    return;
  if (currentState == ST_SENSOR || currentState == ST_CLAUDE || currentState == ST_NOTIFY || currentState == ST_STARTUP)
    return;
  if (lastSensorAutoShowMs != 0 && millis() - lastSensorAutoShowMs < SENSOR_READ_INTERVAL_MS)
    return;
  lastSensorAutoShowMs = millis();
  showSensorScreen();
}

// Non-blocking — called every loop() iteration, same pattern as
// pollClaudeDoneTimeout()/pollNotifyTimeout(). Only actually touches I2C
// while ST_SENSOR is the visible screen, and only once the 5-minute interval
// has elapsed since the last read (which drawSensorScreen() already took
// care of for the moment the screen was entered).
void pollSensorRead()
{
  if (currentState != ST_SENSOR || !sensorAvailable)
    return;
  if (millis() - lastSensorReadMs < SENSOR_READ_INTERVAL_MS)
    return;
  readSensorNow();
  drawSensorReadings();
}
