# Project: Gaze Buddy Firmware (Hardware Core)

## 🎯 Project Overview

This project contains the C++ firmware for the **Gaze Buddy** smart desktop gadget. The core is powered by an **ESP32-S3** мікроконтролер. It drives two displays: a high-resolution color TFT screen for the main interactive face/eyes expression, and a small monochrome I2C OLED display for system telemetry and status monitoring.

The firmware listens to packet-based commands arriving over USB (UART Serial) from a companion Electron desktop application and updates the display states and procedural animations in real time.

---

## 💻 Hardware & Technology Stack

- **Microcontroller:** ESP32-S3 DevKitC-1
- **Development Environment:** PlatformIO (VS Code)
- **Framework:** Arduino Core for ESP32
- **Graphics Engines:** `LovyanGFX` (LGFX v1) — optimized for high-speed rendering and DMA transfers.
- **Primary Display:** ILI9341 2.8" Color TFT ($240 \times 320$, SPI connection)
- **Secondary Display:** SSD1306 0.96" Monochrome OLED ($128 \times 64$, I2C connection)
