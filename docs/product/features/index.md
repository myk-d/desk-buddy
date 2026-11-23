# Features

| # | Feature | Status | Where in code | Spec | Epic |
|---|---------|--------|----------------|------|------|
| 1 | Window-tracker ambient state | shipped | `desktop-app/electron/main.ts`; `firmware/src/serial_protocol.h`, `gaze_state.h`, `claude_screen.h` | — | — |
| 2 | Startup animation (protected) | shipped | `firmware/src/serial_protocol.h` | — | — |
| 3 | Pomodoro timer | shipped | `desktop-app/src/` (Pomodoro page); `firmware/src/pomodoro_screen.h` | — | — |
| 4 | Claude Code activity dashboard | shipped | `firmware/src/claude_screen.h`; `desktop-app` Claude Code hooks (`~/.claude/hooks/`) | — | — |
| 5 | WiFi provisioning | shipped | desktop app welcome screen / Device page; `firmware/src/wifi_manager.h` | — | — |
| 6 | Device HTTP server / ambient notifications | shipped (WiFi-optional) | `firmware/src/web_server.h` | — | — |
| 7 | Climate sensor screen | shipped (hardware-optional) | `firmware/src/sensor_screen.h` | — | — |
| 8 | Manual emotion/animation control + device log | shipped | `desktop-app/src/` Dashboard page; `firmware/src/taby_registry.h`, `taby_screen.h` | — | — |
| 9 | Random "alive" pop-ups | shipped | `firmware/src/taby_screen.h` (`pollTabyRandomShow()`) | — | — |
| 10 | Touchscreen (XPT2046) | partial | `firmware/src/display.h` — driver wired and calibrated, no feature built on it yet | — | — |
| 11 | Firmware flashing / WiFi OTA | removed by design | see `firmware/CLAUDE.md` "Known hardware limitation" and `desktop-app/CLAUDE.md` "Firmware updates" | — | — |
| 12 | Touch-driven tile-menu UI (PC stats/AI tokens/weather/network/alerts) | reverted | fully removed from codebase; rejected as "too cramped, looks bad, flickers" | — | — |

No spec files or Focus tracker (BEAK) epics exist yet for any feature.
