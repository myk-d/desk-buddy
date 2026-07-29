#pragma once

// ═════════════════════════════════════════════════════════════════════════════
// [НОВЕ] WiFi — підключення/сканування/NVS-креденшели/mDNS. Опціонально, лише
// якщо користувач підключив мережу через desktop-застосунок (креденшели
// ніколи не вводяться на самому пристрої). Дозволяє hook-скриптам Claude
// Code оновлювати екран напряму, навіть коли застосунок закритий.
//
// HTTP-маршрути й обробники — див. web_server.h.
// ═════════════════════════════════════════════════════════════════════════════

#include <WiFi.h>
#include <Preferences.h>
#include <ESPmDNS.h>
#include <time.h>

// web_server.h's /status.json handler calls this — defined further down in
// this same file, forward-declared here so it resolves (single translation
// unit, same precedent as applyClaudeState/applyClaudeUsage in main.cpp).
bool ntpSynced();

#include "web_server.h"

Preferences wifiPrefs;
bool wifiConnecting = false;
unsigned long wifiConnectStartMs = 0;
const unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;
bool gazeServerStarted = false;

// Non-blocking scan — WiFi.scanNetworks() (blocking overload) took ~6-7s
// measured on this hardware, freezing the entire loop() for that whole
// window: animations, other serial commands, and this device's own WiFi
// HTTP server all stalled. wifiScanStart() kicks off an async scan and
// returns immediately; wifiPoll() (called every loop() iteration) checks
// WiFi.scanComplete() and reports the result once ready.
bool wifiScanPending = false;

void wifiScanStart()
{
  if (wifiScanPending)
    return; // already scanning — don't start a second overlapping scan
  // On a never-configured device, wifiTryAutoConnect() returns before ever
  // setting a WiFi mode (no saved credentials to connect with) — without
  // this, scanNetworks() silently finds nothing because the radio is still
  // off/null, not because there are no nearby networks.
  WiFi.mode(WIFI_STA);
  WiFi.scanNetworks(true); // async: returns immediately, WIFI_SCAN_RUNNING until done
  wifiScanPending = true;
}

// True once NTP has actually synced — ESP32's clock sits near epoch 0 until
// then, so this is just a sanity threshold (~Nov 2023), not a fixed target.
// configTime() itself is fire-and-forget/non-blocking; sync happens in the
// background over the next few seconds after WiFi connects.
bool ntpSynced()
{
  return time(nullptr) > 1700000000;
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
        configTime(0, 0, "pool.ntp.org"); // async — see ntpSynced()
        webServerBegin();
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

  if (wifiScanPending)
  {
    int n = WiFi.scanComplete();
    if (n >= 0)
    {
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
      wifiScanPending = false;
      Serial.print("WIFI_NETWORKS:");
      Serial.println(result);
    }
    else if (n == WIFI_SCAN_FAILED)
    {
      wifiScanPending = false;
      Serial.println("WIFI_NETWORKS:"); // empty list — resolves the app's pending promise instead of a 20s timeout
    }
    // n == WIFI_SCAN_RUNNING (-1): still going, check again next loop()
  }
}
