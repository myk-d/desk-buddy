#pragma once

// Claude Code — a thin colored status strip at the top + two stat cards
// (SESSION 5h / WEEKLY 7d), styled as rounded stat cards. The strip is only
// redrawn when the sub-state changes (drawClaudeScreen); the cards update
// separately (drawClaudeUsageBars) so #USAGE: doesn't redraw the whole
// screen every time.

void formatResetsIn(char *buf, size_t bufSize, long secs)
{
  if (secs <= 0)
  {
    buf[0] = '\0';
    return;
  }
  long days = secs / 86400;
  long hours = (secs % 86400) / 3600;
  long mins = (secs % 3600) / 60;
  if (days > 0)
    snprintf(buf, bufSize, "resets in %ldd %ldh", days, hours);
  else if (hours > 0)
    snprintf(buf, bufSize, "resets in %ldh %ldm", hours, mins);
  else
    snprintf(buf, bufSize, "resets in %ldm", mins);
}

void drawClaudeCard(int x, int y, int w, int h, const char *label, float pct, uint16_t barColor, long secsLeft)
{
  lcd.fillRoundRect(x, y, w, h, 10, CLAUDE_CARD_BG);

  lcd.setTextSize(1);
  lcd.setTextColor(CLAUDE_TEXT_MUTED, CLAUDE_CARD_BG);
  lcd.setCursor(x + 14, y + 12);
  lcd.print(label);

  char pctBuf[8];
  if (pct >= 0)
    snprintf(pctBuf, sizeof(pctBuf), "%d%%", (int)(pct + 0.5f));
  else
    snprintf(pctBuf, sizeof(pctBuf), "--");
  lcd.setTextSize(3);
  lcd.setTextColor(pct >= 0 ? 0xFFFF : CLAUDE_TEXT_MUTED, CLAUDE_CARD_BG);
  lcd.setCursor(x + 14, y + 28);
  lcd.print(pctBuf);

  const int barX = x + 14, barW = w - 28, barH = 8, barY = y + h - 32;
  lcd.fillRoundRect(barX, barY, barW, barH, barH / 2, CLAUDE_TRACK_COLOR);
  if (pct >= 0)
  {
    float frac = pct / 100.0f;
    if (frac > 1)
      frac = 1;
    if (frac < 0.04f)
      frac = 0.04f; // keep a visible dot even at ~0%
    int fillW = (int)(barW * frac);
    lcd.fillRoundRect(barX, barY, fillW, barH, barH / 2, barColor);
    lcd.fillCircle(barX + fillW, barY + barH / 2, 6, barColor);
  }

  char resetsBuf[32];
  formatResetsIn(resetsBuf, sizeof(resetsBuf), secsLeft);
  lcd.setTextSize(1);
  lcd.setTextColor(CLAUDE_TEXT_MUTED, CLAUDE_CARD_BG);
  lcd.setCursor(x + 14, y + h - 14);
  lcd.print(resetsBuf);
}

void drawClaudeUsageBars()
{
  if (currentState != ST_CLAUDE)
    return;
  lcd.fillRect(0, 30, 320, 210, CLAUDE_BG_DARK);
  drawClaudeCard(10, 38, 300, 96, "SESSION (5H)", claudeFiveHourPct, CLAUDE_PCT_5H_COLOR, claudeFiveHourSecsLeft);
  drawClaudeCard(10, 140, 300, 96, "WEEKLY (7D)", claudeSevenDayPct, CLAUDE_PCT_7D_COLOR, claudeSevenDaySecsLeft);
}

void drawClaudeScreen()
{
  uint16_t stripColor;
  const char *label;
  switch (claudeSubState)
  {
  case 1:
    stripColor = CLAUDE_WORKING_COLOR;
    label = "WORKING";
    break;
  case 2:
    stripColor = CLAUDE_DONE_COLOR;
    label = "DONE";
    break;
  case 3:
    stripColor = CLAUDE_WAITING_COLOR;
    label = "NEEDS INPUT";
    break;
  case 4:
    stripColor = CLAUDE_THINKING_COLOR;
    label = "THINKING";
    break;
  default:
    stripColor = CLAUDE_NEUTRAL_COLOR;
    label = "CLAUDE CODE";
    break;
  }

  lcd.fillScreen(CLAUDE_BG_DARK);
  lcd.fillRect(0, 0, 320, 30, stripColor);
  lcd.setTextSize(1);
  lcd.setTextColor(0x0000, stripColor); // black text — more legible on this small screen than white
  lcd.setCursor(10, 11);
  lcd.print("CLAUDE CODE");
  int labelW = strlen(label) * 6;
  lcd.setCursor(310 - labelW, 11);
  lcd.print(label);

  drawClaudeUsageBars();
}

void setNeo(uint8_t r, uint8_t g, uint8_t b)
{
  pixels.setPixelColor(0, pixels.Color(r, g, b));
  pixels.show();
}

// Each state: frame array, count, delay, color, whether it loops
void enterState(GazeState s)
{
  currentState = s;
  activeIsColorPlayer = false; // mono by default; color states set this true themselves

  // Pomodoro draws to the WHOLE screen, other states only to a small central
  // area. So the whole screen is cleared on ANY state change — otherwise old
  // background/text would linger around the animation after leaving Pomodoro.
  lcd.fillScreen(0x0000);

  // Auto-lock during pomodoro states; unlock when leaving them
  pomoLocked = (s == ST_POMO_WORK || s == ST_POMO_BREAK || s == ST_POMO_LONGBREAK);

  switch (s)
  {
  case ST_STARTUP:
    // startup01.h is also color now (RGB565 delta+RLE) — converted under the
    // old BOOT_ANIM name, hence the constant prefix.
    activeIsColorPlayer = true;
    colorPlayer.load(BOOT_ANIM_frames, BOOT_ANIM_sizes, BOOT_ANIM_types,
                     BOOT_ANIM_FRAME_COUNT, BOOT_ANIM_FPS,
                     BOOT_ANIM_CROP_X, BOOT_ANIM_CROP_Y, BOOT_ANIM_CROP_W, BOOT_ANIM_CROP_H);
    setNeo(128, 0, 12);
    break;
  case ST_IDLE:
    // Color animation via ColorAnimPlayer
    activeIsColorPlayer = true;
    colorPlayer.load(IDLE_ANIM_frames, IDLE_ANIM_sizes, IDLE_ANIM_types,
                     IDLE_ANIM_FRAME_COUNT, IDLE_ANIM_FPS,
                     IDLE_ANIM_CROP_X, IDLE_ANIM_CROP_Y, IDLE_ANIM_CROP_W, IDLE_ANIM_CROP_H);
    setNeo(128, 0, 128);
    break;
  case ST_FOCUS:
    activeIsColorPlayer = true;
    colorPlayer.load(WORK_ANIM_frames, WORK_ANIM_sizes, WORK_ANIM_types,
                     WORK_ANIM_FRAME_COUNT, WORK_ANIM_FPS,
                     WORK_ANIM_CROP_X, WORK_ANIM_CROP_Y, WORK_ANIM_CROP_W, WORK_ANIM_CROP_H);
    setNeo(0, 150, 255);
    break;
  case ST_RELAX:
    activeIsColorPlayer = true;
    colorPlayer.load(HAPPY_ANIM_frames, HAPPY_ANIM_sizes, HAPPY_ANIM_types,
                     HAPPY_ANIM_FRAME_COUNT, HAPPY_ANIM_FPS,
                     HAPPY_ANIM_CROP_X, HAPPY_ANIM_CROP_Y, HAPPY_ANIM_CROP_W, HAPPY_ANIM_CROP_H);
    setNeo(0, 200, 0);
    break;
  case ST_LOVE:
    activeIsColorPlayer = true;
    colorPlayer.load(LOVE_ANIM_frames, LOVE_ANIM_sizes, LOVE_ANIM_types,
                     LOVE_ANIM_FRAME_COUNT, LOVE_ANIM_FPS,
                     LOVE_ANIM_CROP_X, LOVE_ANIM_CROP_Y, LOVE_ANIM_CROP_W, LOVE_ANIM_CROP_H);
    setNeo(255, 0, 150);
    break;
  case ST_ERROR:
    activeIsColorPlayer = true;
    colorPlayer.load(ANGRY_ANIM_frames, ANGRY_ANIM_sizes, ANGRY_ANIM_types,
                     ANGRY_ANIM_FRAME_COUNT, ANGRY_ANIM_FPS,
                     ANGRY_ANIM_CROP_X, ANGRY_ANIM_CROP_Y, ANGRY_ANIM_CROP_W, ANGRY_ANIM_CROP_H);
    setNeo(200, 0, 0);
    break;
  case ST_POMO_WORK:
    // Full screen, no animation — background+label drawn once here; the
    // time+bar arrive separately via #TIME: and update without redrawing the background
    drawPomodoroBackground(POMO_WORK_COLOR, "WORK");
    setNeo(56, 189, 248); // same #38bdf8
    break;
  case ST_POMO_BREAK:
    drawPomodoroBackground(POMO_BREAK_COLOR, "BREAK");
    setNeo(74, 222, 128); // same #4ade80
    break;
  case ST_POMO_LONGBREAK:
    drawPomodoroBackground(POMO_LONGBREAK_COLOR, "LONG BREAK");
    setNeo(99, 102, 241); // same #6366f1
    break;
  case ST_CLAUDE:
    drawClaudeScreen();
    if (claudeSubState == 1)
      setNeo(217, 119, 87); // Claude orange (#D97757)
    else if (claudeSubState == 2)
      setNeo(74, 222, 128);
    else if (claudeSubState == 3)
      setNeo(255, 0, 0);
    else if (claudeSubState == 4)
      setNeo(168, 85, 247); // brand purple (#a855f7) — see pollClaudeActivityPulse for the breathing version
    else
      setNeo(120, 120, 120);
    break;
  case ST_NOTIFY:
    drawNotifyScreen();
    setNeo((notifyColor >> 11 & 0x1F) << 3, (notifyColor >> 5 & 0x3F) << 2, (notifyColor & 0x1F) << 3);
    break;
  }
}

// Shared code for #CLAUDE:/#USAGE: (serial) and /claude-state, /claude-usage
// (WiFi HTTP, see wifi_manager.h) — one single path for applying an update,
// regardless of where it came from.

void applyClaudeState(int sub)
{
  if (pomoLocked)
    return;

  // Recorded even on a repeat "working" ping (see alreadyThere below) — this
  // is exactly the signal pollClaudeActivityPulse() needs: how recently a
  // tool call last fired, regardless of whether the screen itself changes.
  if (sub == 1)
    lastClaudeWorkingPingMs = millis();

  // PreToolUse fires "working" on every single tool call, often several in
  // quick succession — enterState() does a full fillScreen() + redraws both
  // cards from scratch, so re-entering it when nothing actually changed was
  // causing a visible full-screen flicker/clip on every tool call, not just
  // on real state transitions.
  GazeState target = (sub == 0) ? ST_IDLE : ST_CLAUDE;
  bool alreadyThere = (sub == claudeSubState) && (currentState == target);

  claudeSubState = sub;
  claudeDoneAtMs = (sub == 2) ? millis() : 0;

  if (alreadyThere)
    return;

  enterState(target);
}

// NeoPixel activity indicator while Claude is "working" or "thinking" — a
// static solid color looked identical whether something was actually
// happening or the screen was just sitting there. "Working" (orange) is a
// rate-of-change-aware BLINK — an actual on/off toggle, faster right after a
// burst of tool calls, settling into a slower blink once quiet for a few
// seconds — deliberately more attention-grabbing than a fade, since it means
// the device is actively doing something right now. "Thinking" (purple) has
// no comparable per-call bursts to react to (UserPromptSubmit fires once per
// turn, not repeatedly), so it stays a calm steady breathing fade instead —
// blinking would be distracting for a state that can last a while with
// nothing new to report. Non-blocking, throttled to ~25fps since neither
// effect needs — and pixels.show() shouldn't be spammed at — full loop()
// speed.
void pollClaudeActivityPulse()
{
  if (currentState != ST_CLAUDE || (claudeSubState != 1 && claudeSubState != 4))
    return;

  static unsigned long lastUpdateMs = 0;
  unsigned long now = millis();
  if (now - lastUpdateMs < 40)
    return;
  lastUpdateMs = now;

  if (claudeSubState == 1)
  {
    unsigned long sinceLastPing = now - lastClaudeWorkingPingMs;
    unsigned long blinkPeriodMs = (sinceLastPing < 5000) ? 400 : 900;
    bool on = (now % blinkPeriodMs) < (blinkPeriodMs / 2);
    setNeo(on ? 217 : 0, on ? 119 : 0, on ? 87 : 0); // Claude orange (#D97757) or off
    return;
  }

  const unsigned long periodMs = 2200;
  float phase = (now % periodMs) / (float)periodMs;
  float brightness = 0.55f + 0.45f * (0.5f - 0.5f * cosf(phase * 2.0f * PI));
  setNeo((uint8_t)(168 * brightness), (uint8_t)(85 * brightness), (uint8_t)(247 * brightness)); // brand purple (#a855f7)
}

// Non-blocking — called every loop() iteration. Mirrors the desktop app's own
// done->idle timeout so the device doesn't rely on the app being open to ever
// leave the "Done" screen.
void pollClaudeDoneTimeout()
{
  if (claudeSubState == 2 && claudeDoneAtMs != 0 && millis() - claudeDoneAtMs > CLAUDE_DONE_DISPLAY_MS)
  {
    applyClaudeState(0);
    // The app's own claudeCodeState may have been set via handleClaudeRelay()
    // (hooks posting straight to this device over WiFi, bypassing the app's
    // localhost:7842 relay entirely) — that path has no revert timer of its
    // own, so without this the app would think Claude is still "done"
    // forever, which blocks the window-focus tracker (it only runs once
    // claudeCodeState is back to "idle").
    Serial.println("CLAUDE_RELAY:idle");
  }
}

void applyClaudeUsage(float fiveHourPct, long fiveHourSecs, float sevenDayPct, long sevenDaySecs)
{
  claudeFiveHourPct = fiveHourPct;
  claudeFiveHourSecsLeft = fiveHourSecs;
  claudeSevenDayPct = sevenDayPct;
  claudeSevenDaySecsLeft = sevenDaySecs;
  drawClaudeUsageBars();
}
