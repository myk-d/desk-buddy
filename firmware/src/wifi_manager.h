#pragma once

// ═════════════════════════════════════════════════════════════════════════════
// [НОВЕ] WiFi + локальний HTTP-сервер для Claude Code — опціонально, лише
// якщо користувач підключив мережу через desktop-застосунок (креденшели
// ніколи не вводяться на самому пристрої). Дозволяє hook-скриптам Claude
// Code оновлювати екран напряму, навіть коли застосунок закритий.
//
// Формат тіла запиту (POST /claude-state, /claude-usage) — той самий JSON,
// що застосунок уже POST'ить на свій localhost:7842, тож hook-скрипти не
// потребують різної логіки залежно від цілі — лише інша адреса/заголовок.
// Розбір тут — просте indexOf/substring (як і для #USAGE: серійного
// протоколу), без залежності ArduinoJson: формат фіксований і контролюється
// нами самими з обох боків.
// ═════════════════════════════════════════════════════════════════════════════

#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ESPmDNS.h>

// Визначені пізніше в main.cpp — HTTP-обробники нижче ведуть до того самого
// коду, що й серійні команди #CLAUDE:/#USAGE:.
void applyClaudeState(int sub);
void applyClaudeUsage(float fiveHourPct, long fiveHourSecs, float sevenDayPct, long sevenDaySecs);

Preferences wifiPrefs;
WebServer gazeServer(80);
String gazeToken = "";
bool wifiConnecting = false;
unsigned long wifiConnectStartMs = 0;
const unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;
bool gazeServerStarted = false;

String wifiScanNetworks()
{
  // On a never-configured device, wifiTryAutoConnect() returns before ever
  // setting a WiFi mode (no saved credentials to connect with) — without
  // this, scanNetworks() silently finds nothing because the radio is still
  // off/null, not because there are no nearby networks.
  WiFi.mode(WIFI_STA);
  int n = WiFi.scanNetworks();
  String result = "";
  for (int i = 0; i < n; i++)
  {
    if (i > 0)
      result += ";";
    result += WiFi.SSID(i);
    result += ",";
    result += String(WiFi.RSSI(i));
  }
  WiFi.scanDelete();
  return result;
}

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

void wifiLoadCredentials(String &ssid, String &password, String &token)
{
  wifiPrefs.begin("wifi", true);
  ssid = wifiPrefs.getString("ssid", "");
  password = wifiPrefs.getString("password", "");
  token = wifiPrefs.getString("token", "");
  wifiPrefs.end();
}

void wifiSaveCredentials(const String &ssid, const String &password, const String &token)
{
  wifiPrefs.begin("wifi", false);
  wifiPrefs.putString("ssid", ssid);
  wifiPrefs.putString("password", password);
  wifiPrefs.putString("token", token);
  wifiPrefs.end();
}

void wifiForget()
{
  wifiPrefs.begin("wifi", false);
  wifiPrefs.clear();
  wifiPrefs.end();
  gazeToken = "";
  WiFi.disconnect(true);
}

void wifiBeginConnect(const String &ssid, const String &password, const String &token)
{
  wifiSaveCredentials(ssid, password, token);
  gazeToken = token;
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  wifiConnecting = true;
  wifiConnectStartMs = millis();
}

void wifiTryAutoConnect()
{
  String ssid, password, token;
  wifiLoadCredentials(ssid, password, token);
  if (ssid.length() == 0)
    return;
  gazeToken = token;
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  wifiConnecting = true;
  wifiConnectStartMs = millis();
}

// Викликається щоразу з loop() — неблокуюче. Повідомляє про зміну стану
// підключення через Serial один раз (не щоразу), коли воно стається.
void wifiPoll()
{
  if (wifiConnecting)
  {
    if (WiFi.status() == WL_CONNECTED)
    {
      wifiConnecting = false;
      if (!gazeServerStarted)
      {
        if (MDNS.begin("gaze-buddy"))
        {
          MDNS.addService("http", "tcp", 80);
        }
        gazeServer.on("/claude-state", HTTP_POST, handleClaudeStateHttp);
        gazeServer.on("/claude-usage", HTTP_POST, handleClaudeUsageHttp);
        gazeServer.begin();
        gazeServerStarted = true;
      }
      Serial.print("WIFI_STATUS:connected,");
      Serial.println(WiFi.localIP().toString());
    }
    else if (millis() - wifiConnectStartMs > WIFI_CONNECT_TIMEOUT_MS)
    {
      wifiConnecting = false;
      Serial.println("WIFI_STATUS:failed");
    }
  }

  if (gazeServerStarted && WiFi.status() == WL_CONNECTED)
  {
    gazeServer.handleClient();
  }
}
