#pragma once

// Claude Code — a thin colored status strip at the top (CLAUDE CODE / account
// email / sub-state, all on one line) + two ring-style stat cards side by
// side (SESSION 5h / WEEKLY 7d). The strip's state/label are only redrawn
// when the sub-state changes (drawClaudeScreen); the email band within it and
// the two cards update separately (drawClaudeUsageBars) so #USAGE: doesn't
// redraw the whole screen every time.

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

// Session-ring/NeoPixel severity grading — same thresholds as the desktop
// app's pctColor() (DevicePage.tsx). 0=ok (<70%), 1=medium (70-89%), 2=high
// (>=90%). Only ever fed claudeFiveHourPct — the weekly ring/color is fixed.
int claudeUsageSeverity(float pct)
{
  if (pct >= 90)
    return 2;
  if (pct >= 70)
    return 1;
  return 0;
}

uint16_t claudeSeverityRingColor(int severity)
{
  switch (severity)
  {
  case 2:
    return CLAUDE_PCT_HIGH_COLOR;
  case 1:
    return CLAUDE_PCT_MED_COLOR;
  default:
    return CLAUDE_PCT_OK_COLOR;
  }
}

void claudeSeverityRGB(int severity, uint8_t &r, uint8_t &g, uint8_t &b)
{
  switch (severity)
  {
  case 2:
    r = 248; g = 113; b = 113; break; // red-400
  case 1:
    r = 251; g = 191; b = 36; break; // amber-400
  default:
    r = 34; g = 197; b = 94; break; // green-500
  }
}

// Matches the switch in drawClaudeScreen() — kept separate (rather than
// having drawClaudeScreen call this) so that one stays a simple, obviously
// paired stripColor+label switch, while this gets reused by the email-only
// partial redraw below, which never needs the label.
uint16_t claudeStripColor()
{
  switch (claudeSubState)
  {
  case 1:
    return CLAUDE_WORKING_COLOR;
  case 2:
    return CLAUDE_DONE_COLOR;
  case 3:
    return CLAUDE_WAITING_COLOR;
  case 4:
    return CLAUDE_THINKING_COLOR;
  default:
    return CLAUDE_NEUTRAL_COLOR;
  }
}

// Redraws just the middle band of the top strip (account email), without
// touching the "CLAUDE CODE" label on the left or the sub-state label on the
// right — called both from the full-screen paint (drawClaudeScreen) and from
// drawClaudeUsageBars() (email rides along on every #USAGE update, but
// changes rarely — redrawing this small band each time is cheap and avoids
// a stale email lingering after a #USAGE arrives with a newer one).
void drawClaudeStripEmail()
{
  uint16_t stripColor = claudeStripColor();
  const int bandX = 85, bandW = 153; // x 85..238 — clear of "CLAUDE CODE" (ends ~76) and the longest sub-state label, "NEEDS INPUT" (starts ~244)
  lcd.fillRect(bandX, 0, bandW, 30, stripColor);
  lcd.setTextSize(1);
  lcd.setTextColor(0x0000, stripColor); // black text — more legible on this small screen than white
  int emailW = claudeAccountEmail.length() * 6;
  lcd.setCursor(160 - emailW / 2, 11);
  lcd.print(claudeAccountEmail);
}

// Circular progress ring: track (full circle) + a clockwise-filled arc
// starting at 12 o'clock (angle 270 in LovyanGFX's 0=east/clockwise scheme),
// punched through the middle with the card's own background so it reads as
// a ring rather than a filled disc.
void drawProgressRingTrack(int cx, int cy, int rOuter, int rInner)
{
  lcd.fillCircle(cx, cy, rOuter, CLAUDE_TRACK_COLOR);
  lcd.fillCircle(cx, cy, rInner, CLAUDE_CARD_BG);
}

void drawClaudeRingCard(int x, int y, int w, int h, const char *label, float pct, uint16_t ringColor, long secsLeft)
{
  lcd.fillRoundRect(x, y, w, h, 10, CLAUDE_CARD_BG);

  // Label pinned near the top edge of the card (not centered with the ring
  // below it) — same reasoning applies to the reset text pinned near the
  // bottom, so the ring gets to be the visually dominant element in between.
  const float labelSize = 1.5f;
  lcd.setTextSize(labelSize);
  lcd.setTextColor(CLAUDE_TEXT_MUTED, CLAUDE_CARD_BG);
  int labelW = (int)(strlen(label) * 6 * labelSize);
  lcd.setCursor(x + (w - labelW) / 2, y + 8);
  lcd.print(label);

  const int cx = x + w / 2, rOuter = 58, rInner = 48;
  const int cy = y + 32 + rOuter; // below the label + a gap

  drawProgressRingTrack(cx, cy, rOuter, rInner);
  if (pct >= 0)
  {
    float frac = pct / 100.0f;
    if (frac > 1)
      frac = 1;
    if (frac < 0.02f)
      frac = 0.02f; // keep a visible sliver even at ~0%, same as the old linear bar's min-dot
    lcd.fillArc(cx, cy, rOuter, rInner, 270, 270 + frac * 360, ringColor);
  }

  char pctBuf[8];
  if (pct >= 0)
    snprintf(pctBuf, sizeof(pctBuf), "%d%%", (int)(pct + 0.5f));
  else
    snprintf(pctBuf, sizeof(pctBuf), "--");
  // 3.5, not 4 — at size 4 "100%" (the one 4-char value) would span the full
  // 96px inner-circle diameter with zero margin and risk clipping into the
  // ring; 3.5 keeps a few px of breathing room even for that case.
  const float pctSize = 3.5f;
  lcd.setTextSize(pctSize);
  lcd.setTextColor(pct >= 0 ? 0xFFFF : CLAUDE_TEXT_MUTED, CLAUDE_CARD_BG);
  int pctW = (int)(strlen(pctBuf) * 6 * pctSize);
  lcd.setCursor(cx - pctW / 2, cy - (int)(8 * pctSize) / 2);
  lcd.print(pctBuf);

  char resetsBuf[32];
  formatResetsIn(resetsBuf, sizeof(resetsBuf), secsLeft);
  const float resetSize = 1.3f;
  lcd.setTextSize(resetSize);
  lcd.setTextColor(CLAUDE_TEXT_MUTED, CLAUDE_CARD_BG);
  int resetW = (int)(strlen(resetsBuf) * 6 * resetSize);
  lcd.setCursor(cx - resetW / 2, y + h - 8 - (int)(8 * resetSize));
  lcd.print(resetsBuf);
}

void drawClaudeUsageBars()
{
  if (currentState != ST_CLAUDE)
    return;
  lcd.fillRect(0, 30, 320, 210, CLAUDE_BG_DARK);
  drawClaudeStripEmail();

  uint16_t sessionColor = claudeFiveHourPct >= 0 ? claudeSeverityRingColor(claudeUsageSeverity(claudeFiveHourPct)) : CLAUDE_PCT_5H_COLOR;
  drawClaudeRingCard(8, 36, 145, 196, "SESSION (5H)", claudeFiveHourPct, sessionColor, claudeFiveHourSecsLeft);
  drawClaudeRingCard(167, 36, 145, 196, "WEEKLY (7D)", claudeSevenDayPct, CLAUDE_PCT_7D_COLOR, claudeSevenDaySecsLeft);
}

void drawClaudeScreen()
{
  uint16_t stripColor = claudeStripColor();
  const char *label;
  switch (claudeSubState)
  {
  case 1:
    label = "WORKING";
    break;
  case 2:
    label = "DONE";
    break;
  case 3:
    label = "NEEDS INPUT";
    break;
  case 4:
    label = "THINKING";
    break;
  default:
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
  drawClaudeStripEmail();

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
    {
      // Same session-usage severity grading as the ring/blink below — this
      // is just the static color shown for the one frame before
      // pollClaudeActivityPulse() takes over the blinking.
      if (claudeFiveHourPct >= 0)
      {
        uint8_t r, g, b;
        claudeSeverityRGB(claudeUsageSeverity(claudeFiveHourPct), r, g, b);
        setNeo(r, g, b);
      }
      else
        setNeo(217, 119, 87); // no usage data yet — plain Claude orange (#D97757)
    }
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
// happening or the screen was just sitting there. "Working" is a
// rate-of-change-aware BLINK — an actual on/off toggle, faster right after a
// burst of tool calls, settling into a slower blink once quiet for a few
// seconds — deliberately more attention-grabbing than a fade, since it means
// the device is actively doing something right now. Its color is graded by
// session-usage severity (claudeSeverityRGB) rather than fixed Claude
// orange, so a glance at the LED alone hints at how close the 5h limit is.
// "Thinking" (purple) has
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
    uint8_t r = 217, g = 119, b = 87; // no usage data yet — plain Claude orange (#D97757)
    if (claudeFiveHourPct >= 0)
      claudeSeverityRGB(claudeUsageSeverity(claudeFiveHourPct), r, g, b);
    setNeo(on ? r : 0, on ? g : 0, on ? b : 0);
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

void applyClaudeUsage(float fiveHourPct, long fiveHourSecs, float sevenDayPct, long sevenDaySecs, const String &email)
{
  claudeFiveHourPct = fiveHourPct;
  claudeFiveHourSecsLeft = fiveHourSecs;
  claudeSevenDayPct = sevenDayPct;
  claudeSevenDaySecsLeft = sevenDaySecs;
  // Only the app knows the account email (it reads ~/.claude.json) — an
  // empty string here just means "this particular sender didn't send one"
  // (e.g. a stale hook script), not "no email", so don't clobber what's
  // already shown.
  if (email.length() > 0)
    claudeAccountEmail = email;
  drawClaudeUsageBars();
}
