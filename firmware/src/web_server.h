#pragma once

// ═════════════════════════════════════════════════════════════════════════════
// Локальний HTTP-сервер (WiFi) — усі маршрути й обробники. Розділено з
// wifi_manager.h (яка лишає собі підключення/сканування/NVS/mDNS), бо цей
// файл зростає з новими фічами (діагностика, дашборд, notify, OTA).
// ═════════════════════════════════════════════════════════════════════════════

#include <WebServer.h>
#include <Update.h>

// Визначені пізніше в main.cpp — HTTP-обробники нижче ведуть до того самого
// коду, що й серійні команди #CLAUDE:/#USAGE:.
void applyClaudeState(int sub);
void applyClaudeUsage(float fiveHourPct, long fiveHourSecs, float sevenDayPct, long sevenDaySecs);
void applyNotify(const String &title, const String &message, uint16_t color, unsigned long durationMs);

WebServer gazeServer(80);
String gazeToken = "";

// Витягує рядкове значення "key":"value" з фіксованого JSON-тіла.
String jsonExtractString(const String &body, const String &key)
{
  String needle = "\"" + key + "\":\"";
  int start = body.indexOf(needle);
  if (start == -1)
    return "";
  start += needle.length();
  int end = body.indexOf('"', start);
  if (end == -1)
    return "";
  return body.substring(start, end);
}

// Витягує числове значення "key":123.45 (або null → fallback).
float jsonExtractNumber(const String &body, const String &key, float fallback)
{
  String needle = "\"" + key + "\":";
  int start = body.indexOf(needle);
  if (start == -1)
    return fallback;
  start += needle.length();
  int end = start;
  while (end < (int)body.length() && (isDigit(body[end]) || body[end] == '-' || body[end] == '.'))
    end++;
  if (end == start)
    return fallback;
  return body.substring(start, end).toFloat();
}

bool checkGazeToken()
{
  if (gazeToken.length() == 0)
    return false; // WiFi не налаштовано через наш протокол — відхиляємо все
  return gazeServer.header("X-Gaze-Token") == gazeToken;
}

void handleClaudeStateHttp()
{
  if (!checkGazeToken())
  {
    gazeServer.send(403, "text/plain", "forbidden");
    return;
  }
  String body = gazeServer.arg("plain");
  String state = jsonExtractString(body, "state");
  int subCode = -1;
  if (state == "idle")
    subCode = 0;
  else if (state == "working")
    subCode = 1;
  else if (state == "done")
    subCode = 2;
  else if (state == "waiting")
    subCode = 3;
  if (subCode >= 0)
  {
    applyClaudeState(subCode);
    // Relay back over USB so the app's own UI stays in sync if it's open.
    Serial.print("CLAUDE_RELAY:");
    Serial.println(state);
  }
  gazeServer.send(200, "text/plain", "ok");
}

void handleClaudeUsageHttp()
{
  if (!checkGazeToken())
  {
    gazeServer.send(403, "text/plain", "forbidden");
    return;
  }
  String body = gazeServer.arg("plain");
  float fiveHourPct = jsonExtractNumber(body, "fiveHourPct", -1);
  long fiveHourSecs = (long)jsonExtractNumber(body, "fiveHourSecsLeft", 0);
  float sevenDayPct = jsonExtractNumber(body, "sevenDayPct", -1);
  long sevenDaySecs = (long)jsonExtractNumber(body, "sevenDaySecsLeft", 0);
  applyClaudeUsage(fiveHourPct, fiveHourSecs, sevenDayPct, sevenDaySecs);

  Serial.print("USAGE_RELAY:");
  Serial.print(fiveHourPct);
  Serial.print(",");
  Serial.print(fiveHourSecs);
  Serial.print(",");
  Serial.print(sevenDayPct);
  Serial.print(",");
  Serial.println(sevenDaySecs);

  gazeServer.send(200, "text/plain", "ok");
}

const char *gazeStateName()
{
  switch (currentState)
  {
  case ST_STARTUP: return "startup";
  case ST_IDLE: return "idle";
  case ST_FOCUS: return "focus";
  case ST_RELAX: return "relax";
  case ST_LOVE: return "love";
  case ST_ERROR: return "error";
  case ST_POMO_WORK: return "pomo_work";
  case ST_POMO_BREAK: return "pomo_break";
  case ST_POMO_LONGBREAK: return "pomo_longbreak";
  case ST_CLAUDE: return "claude";
  case ST_NOTIFY: return "notify";
  default: return "unknown";
  }
}

// GET /status.json — no auth: read-only, low-sensitivity, LAN-only, same
// convention as a typical IoT device status page. Every state-*changing*
// endpoint (/claude-state, /claude-usage, and later /notify, /update) stays
// token-gated; this one and the dashboard below don't need to be.
void handleStatusJson()
{
  String json = "{";
  json += "\"heap\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"uptimeMs\":" + String(millis()) + ",";
  json += "\"state\":\"" + String(gazeStateName()) + "\",";
  json += "\"firmware\":\"" FIRMWARE_VERSION "\",";
  json += "\"ssid\":\"" + WiFi.SSID() + "\",";
  json += "\"ntpSynced\":" + String(ntpSynced() ? "true" : "false") + ",";
  json += "\"time\":" + String((long)time(nullptr));
  json += "}";
  gazeServer.send(200, "application/json", json);
}

// GET / — small static page, no server-side templating: fetches
// /status.json client-side and re-renders every couple seconds.
const char DASHBOARD_HTML[] PROGMEM = R"HTML(<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gaze Buddy</title>
<style>
body{font-family:-apple-system,sans-serif;background:#0c0a09;color:#e7e5e4;margin:0;padding:24px}
h1{font-size:20px;margin:0 0 16px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #292524;font-size:14px}
.row span:first-child{color:#a8a29e}
#err{color:#f87171;margin-top:16px}
</style></head>
<body>
<h1>Gaze Buddy</h1>
<div id="rows"></div>
<div id="err"></div>
<script>
function render(d) {
  document.getElementById('rows').innerHTML = [
    ['State', d.state],
    ['Firmware', d.firmware],
    ['WiFi network', d.ssid],
    ['Signal', d.rssi + ' dBm'],
    ['Free heap', Math.round(d.heap / 1024) + ' KB'],
    ['Uptime', Math.round(d.uptimeMs / 60000) + ' min'],
    ['Time', d.ntpSynced ? new Date(d.time * 1000).toLocaleString() : 'not synced yet'],
  ].map(([k, v]) => '<div class="row"><span>' + k + '</span><span>' + v + '</span></div>').join('');
  document.getElementById('err').textContent = '';
}
function poll() {
  fetch('/status.json').then(r => r.json()).then(render)
    .catch(() => { document.getElementById('err').textContent = 'Could not reach device.'; });
}
poll();
setInterval(poll, 3000);
</script>
</body></html>)HTML";

void handleDashboardHtml()
{
  gazeServer.send_P(200, "text/html", DASHBOARD_HTML);
}

// POST /notify — generic ambient-status update, not tied to Claude Code.
// {"title":"...","message":"...","color":65535,"durationMs":5000}
// `color` is a raw RGB565 value (same encoding used everywhere else on this
// display) so callers don't need to think about color-format conversion.
// Auto-reverts to idle after durationMs (pollNotifyTimeout(), notify_screen.h)
// — same pattern as the Claude "done" screen already uses.
void handleNotifyHttp()
{
  if (!checkGazeToken())
  {
    gazeServer.send(403, "text/plain", "forbidden");
    return;
  }
  String body = gazeServer.arg("plain");
  String title = jsonExtractString(body, "title");
  String message = jsonExtractString(body, "message");
  uint16_t color = (uint16_t)jsonExtractNumber(body, "color", 0xFFFF);
  unsigned long durationMs = (unsigned long)jsonExtractNumber(body, "durationMs", 5000);
  applyNotify(title, message, color, durationMs);
  gazeServer.send(200, "text/plain", "ok");
}

// POST /update — OTA firmware flash over WiFi, sidestepping the USB
// bootloader-reset dance entirely (this device's Linux USB-CDC driver
// doesn't support the DTR/RTS toggling esptool normally relies on). The
// partition table already has otadata+app0+app1 (confirmed before writing
// this), so Update.h's usual ping-pong OTA mechanism works with no changes.
//
// Must arrive as multipart/form-data (a real file-upload body, not a raw
// octet-stream POST) — WebServer's upload callback is the only path here
// that streams the body incrementally; a plain POST gets fully buffered
// into a String by the framework before any handler runs, which would
// exceed available RAM for a >1MB firmware image.
bool otaAuthorized = false;

// Called once the upload (handleUpdateUpload below) has fully streamed in —
// sends the actual HTTP response, since the upload callback can't cleanly
// do that mid-stream.
void handleUpdateHttp()
{
  gazeServer.sendHeader("Connection", "close");
  if (!otaAuthorized)
  {
    gazeServer.send(403, "text/plain", "forbidden");
    return;
  }
  if (Update.hasError())
  {
    gazeServer.send(500, "text/plain", "update failed");
    return;
  }
  gazeServer.send(200, "text/plain", "update ok, rebooting");
  delay(500); // let the response actually flush before rebooting (same precedent as the #R serial command)
  ESP.restart();
}

void handleUpdateUpload()
{
  HTTPUpload &upload = gazeServer.upload();
  if (upload.status == UPLOAD_FILE_START)
  {
    otaAuthorized = checkGazeToken();
    if (!otaAuthorized)
      return; // rejected cleanly in handleUpdateHttp() once this (ignored) upload finishes
    if (!Update.begin(UPDATE_SIZE_UNKNOWN))
      Update.printError(Serial);
  }
  else if (upload.status == UPLOAD_FILE_WRITE)
  {
    if (!otaAuthorized)
      return;
    if (Update.write(upload.buf, upload.currentSize) != upload.currentSize)
      Update.printError(Serial);
  }
  else if (upload.status == UPLOAD_FILE_END)
  {
    if (!otaAuthorized)
      return;
    if (!Update.end(true))
      Update.printError(Serial);
  }
}

// Реєструє всі маршрути + власні заголовки (X-Gaze-Token). Викликається один
// раз, одразу після першого успішного підключення до WiFi (wifiPoll()).
void webServerBegin()
{
  // WebServer only exposes headers explicitly registered here — without
  // this, server.header("X-Gaze-Token") always returns "" and every
  // request gets rejected as forbidden, even with the correct token.
  const char *headerKeys[] = {"X-Gaze-Token"};
  gazeServer.collectHeaders(headerKeys, 1);
  gazeServer.on("/claude-state", HTTP_POST, handleClaudeStateHttp);
  gazeServer.on("/claude-usage", HTTP_POST, handleClaudeUsageHttp);
  gazeServer.on("/status.json", HTTP_GET, handleStatusJson);
  gazeServer.on("/", HTTP_GET, handleDashboardHtml);
  gazeServer.on("/notify", HTTP_POST, handleNotifyHttp);
  gazeServer.on("/update", HTTP_POST, handleUpdateHttp, handleUpdateUpload);
  gazeServer.begin();
}
