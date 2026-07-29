#pragma once

// ═════════════════════════════════════════════════════════════════════════════
// Serial — протокол #ANIM:<назва>\n  та  #R\n
// ═════════════════════════════════════════════════════════════════════════════

// Fixed buffer instead of a String — the old `packetBuf += c` ran once per
// received serial byte at 115200 baud, each call risking a heap
// realloc-check on a device meant to run indefinitely. Same 256-byte cap and
// drop-on-overflow behavior as before.
char packetBuf[256];
size_t packetLen = 0;
bool inPacket = false;

void handlePacket(const String &cmd)
{
  if (cmd == "R")
  {
    delay(50);
    ESP.restart();
    return;
  }

  if (cmd == "VERSION")
  {
    Serial.println("FIRMWARE:" FIRMWARE_VERSION);
    return;
  }

  // [НОВЕ] #TIME:<секунди_залишилось>:<всього_секунд> — оновлює великий час
  // і прогрес-бар. Працює ТІЛЬКИ в режимах ST_POMO_WORK/ST_POMO_BREAK/
  // ST_POMO_LONGBREAK — звичайний #ANIM:focus (без pomo) цю команду просто ігнорує.
  if (cmd.startsWith("TIME:"))
  {
    if (currentState == ST_POMO_WORK || currentState == ST_POMO_BREAK || currentState == ST_POMO_LONGBREAK)
    {
      String rest = cmd.substring(5);
      int sep = rest.indexOf(':');
      int secondsLeft = (sep >= 0) ? rest.substring(0, sep).toInt() : rest.toInt();
      int totalSeconds = (sep >= 0) ? rest.substring(sep + 1).toInt() : 0;
      drawPomodoroTime(secondsLeft, totalSeconds);
    }
    return;
  }

  if (cmd.startsWith("CLAUDE:"))
  {
    if (pomoLocked)
    {
      Serial.println("🔒 pomo locked — CLAUDE ignored");
      return;
    }
    String sub = cmd.substring(7);
    int subCode = -1;
    if (sub == "idle")
      subCode = 0;
    else if (sub == "working")
      subCode = 1;
    else if (sub == "done")
      subCode = 2;
    else if (sub == "waiting")
      subCode = 3;
    if (subCode >= 0)
    {
      applyClaudeState(subCode);
      Serial.print("✅ CLAUDE → ");
      Serial.println(sub);
    }
    return;
  }

  if (cmd.startsWith("USAGE:"))
  {
    // #USAGE:<5hPct>,<5hSecsLeft>,<7dPct>,<7dSecsLeft>\n — секунди до
    // скидання рахує додаток (у нього є реальний час), прошивка лише показує.
    String rest = cmd.substring(6);
    int c1 = rest.indexOf(',');
    int c2 = (c1 >= 0) ? rest.indexOf(',', c1 + 1) : -1;
    int c3 = (c2 >= 0) ? rest.indexOf(',', c2 + 1) : -1;
    if (c1 >= 0 && c2 >= 0 && c3 >= 0)
    {
      applyClaudeUsage(
          rest.substring(0, c1).toFloat(),
          rest.substring(c1 + 1, c2).toInt(),
          rest.substring(c2 + 1, c3).toFloat(),
          rest.substring(c3 + 1).toInt());
    }
    return;
  }

  if (cmd == "WIFI:SCAN")
  {
    wifiScanStart(); // non-blocking — result arrives later via wifiPoll()
    return;
  }

  if (cmd.startsWith("WIFI:CONNECT:"))
  {
    // #WIFI:CONNECT:<token>:<ssid>,<password>\n — token first (fixed 32-hex
    // chars, no ambiguous delimiters) so a comma inside the password can't
    // be confused with a field separator; only a comma inside the SSID
    // itself (rare in practice) would still misparse.
    String rest = cmd.substring(13);
    int tokenEnd = rest.indexOf(':');
    if (tokenEnd >= 0)
    {
      String token = rest.substring(0, tokenEnd);
      String ssidAndPass = rest.substring(tokenEnd + 1);
      int commaIdx = ssidAndPass.indexOf(',');
      if (commaIdx >= 0)
      {
        String ssid = ssidAndPass.substring(0, commaIdx);
        String password = ssidAndPass.substring(commaIdx + 1);
        wifiBeginConnect(ssid, password, token);
        Serial.println("✅ WIFI:CONNECT started");
      }
    }
    return;
  }

  if (cmd == "WIFI:STATUS")
  {
    if (WiFi.status() == WL_CONNECTED)
    {
      Serial.print("WIFI_STATUS:connected,");
      Serial.println(WiFi.localIP().toString());
    }
    else
    {
      Serial.println("WIFI_STATUS:disconnected");
    }
    return;
  }

  if (cmd == "WIFI:FORGET")
  {
    wifiForget();
    Serial.println("✅ WIFI:FORGET done");
    return;
  }

  if (cmd.startsWith("ANIM:"))
  {
    String name = cmd.substring(5);

    // Pomo and idle always go through; other window-tracker anims are blocked while pomoLocked.
    bool isPomoAnim = (name == "pomowork" || name == "pomobreak" || name == "pomolongbreak" || name == "idle");
    if (pomoLocked && !isPomoAnim)
    {
      Serial.println("🔒 pomo locked — ANIM ignored");
      return;
    }

    if (name == "startup")
    {
      enterState(ST_STARTUP);
      Serial.println("✅ ANIM → startup");
    }
    else if (name == "idle")
    {
      enterState(ST_IDLE);
      Serial.println("✅ ANIM → idle");
    }
    else if (name == "focus")
    {
      enterState(ST_FOCUS);
      Serial.println("✅ ANIM → focus");
    }
    else if (name == "relax")
    {
      enterState(ST_RELAX);
      Serial.println("✅ ANIM → relax");
    }
    else if (name == "love")
    {
      enterState(ST_LOVE);
      Serial.println("✅ ANIM → love");
    }
    else if (name == "error")
    {
      enterState(ST_ERROR);
      Serial.println("✅ ANIM → error");
    }
    else if (name == "pomowork")
    {
      enterState(ST_POMO_WORK);
      Serial.println("✅ ANIM → pomowork (повний екран)");
    }
    else if (name == "pomobreak")
    {
      enterState(ST_POMO_BREAK);
      Serial.println("✅ ANIM → pomobreak (повний екран)");
    }
    else if (name == "pomolongbreak")
    {
      enterState(ST_POMO_LONGBREAK);
      Serial.println("✅ ANIM → pomolongbreak (повний екран)");
    }
    else
    {
      Serial.print("⚠️ Невідома анімація: ");
      Serial.println(name);
    }
  }
  else
  {
    Serial.print("⚠️ Невідома команда: #");
    Serial.println(cmd);
  }
}

void readSerial()
{
  while (Serial.available())
  {
    char c = (char)Serial.read();
    if (c == '#')
    {
      inPacket = true;
      packetLen = 0;
      continue;
    }
    if (!inPacket)
      continue;
    if (c == '\n')
    {
      inPacket = false;
      handlePacket(String(packetBuf, packetLen)); // one allocation per complete line, not per byte
      packetLen = 0;
      continue;
    }
    // Was 32 — bumped to fit #WIFI:CONNECT:<token>:<ssid>,<password> (SSID up
    // to 32 bytes + WPA2 password up to 64 + a 32-char hex token + prefixes).
    if (packetLen < sizeof(packetBuf) - 1)
      packetBuf[packetLen++] = c;
  }
}
