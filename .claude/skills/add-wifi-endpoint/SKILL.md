---
name: add-wifi-endpoint
description: Add a new HTTP route to the Gaze Buddy device's WiFi web server. Use when a new feature needs the device to receive or serve something over WiFi (a new POST action, a new GET status/page).
---

# Add a new WiFi HTTP endpoint

The recipe used for `/claude-state`, `/claude-usage`, `/notify`, `/status.json`, `/`, and `/update` — all live in `firmware/src/web_server.h`.

## 1. Decide: token-gated or open?

- **State-changing** (anything that makes the device do something): token-gated. Check `checkGazeToken()` at the top of the handler, `gazeServer.send(403, "text/plain", "forbidden")` and `return` if it fails.
- **Read-only, low-sensitivity** (status/diagnostics/dashboard): no auth needed, matching the existing `/status.json` and `/` precedent — but flag this choice explicitly to the user if it's ambiguous, don't assume silently.

## 2. Write the handler in `web_server.h`

```cpp
void handleSomethingHttp()
{
  if (!checkGazeToken())  // omit if intentionally unauthenticated
  {
    gazeServer.send(403, "text/plain", "forbidden");
    return;
  }
  String body = gazeServer.arg("plain");
  // Extract fields with the existing helpers — no ArduinoJson dependency:
  String someField = jsonExtractString(body, "someField");
  float someNumber = jsonExtractNumber(body, "someNumber", /* fallback */ 0);

  // ... do the thing, e.g. call into a *_screen.h's applyX() function ...

  gazeServer.send(200, "text/plain", "ok");
}
```

If the handler needs a function defined in a `*_screen.h` file that's included *after* `web_server.h` in `main.cpp` (true for anything touching the display/state — `web_server.h` is included early via `wifi_manager.h`), add a forward declaration near the top of `web_server.h`, next to the existing `applyClaudeState`/`applyClaudeUsage`/`applyNotify` ones.

For a large binary body (file upload, e.g. OTA), a plain POST gets fully buffered into a `String` by the `WebServer` library before your handler runs — for anything more than a few KB, use the two-callback `HTTPUpload` pattern instead (see `handleUpdateHttp`/`handleUpdateUpload` in `web_server.h` for the reference implementation), which requires the client to send `multipart/form-data`, not a raw octet-stream body.

## 3. Register the route

In `webServerBegin()` (same file):

```cpp
gazeServer.on("/something", HTTP_POST, handleSomethingHttp);
```

If it needs a header beyond `X-Gaze-Token`, add it to the `collectHeaders()` call in the same function — **headers are invisible to `WebServer` unless explicitly collected**, a real gotcha that caused a silent-403-with-correct-token bug before.

## 4. If relaying state back over serial (optional)

If the app might have a live USB connection and should stay in sync, `Serial.println("SOMETHING_RELAY:...")` after applying the change — matches `CLAUDE_RELAY:`/`USAGE_RELAY:` precedent. The app's serial `data` handler in `electron/main.ts` buffers to complete lines before matching (don't skip this if adding a new relay line — a raw per-chunk regex match is fragile against a line arriving split across two writes, a bug hit and fixed before).

## 5. App-side wiring, if the app needs to call this endpoint

See the `add-ipc-channel` skill — same three-file IPC pattern (`main.ts`/`preload.ts`/`types.ts`), then an `http.request`/`https.request` call to `http://gaze-buddy.local/<path>` with the token from `wifiStore`.

## 6. Verify

Compile (`firmware-checker` agent or `pio run` directly), redeploy (`flash-firmware` skill), then test with `curl` — see the `test-device` skill for the exact auth-check pattern (wrong token → 403, correct → 200, all in one Bash call to avoid interference from concurrent hook activity).
