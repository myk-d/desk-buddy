#pragma once

// "Bonus" Taby character animations (#TABY:<id>) — everything from the
// original firmware-taby device's animation set that isn't one of the 6
// dedicated states (idle/focus/relax/love/error/startup — those load
// tabyPlayer directly from enterState() in claude_screen.h, by a fixed id,
// no registry lookup needed). Played back straight from LittleFS via
// AnimatedGIF (taby_gif_player.h) rather than baked into the binary as
// PROGMEM — all 84 full-canvas character GIFs came out to 34MB in our old
// RLE format (doesn't fit in a 6.25MB app partition), but only 9.93MB as
// the original GIFs on a filesystem partition.

#include "taby_gif_player.h"
#include "taby_registry.h"

void playTabyAnimation(const char *id)
{
  const TabyAnimInfo *info = findTabyAnimation(id);
  if (!info)
  {
    Serial.print("⚠️ Unknown Taby animation: ");
    Serial.println(id);
    return;
  }
  if (!tabyPlayer.load(id))
  {
    Serial.print("⚠️ Taby GIF not found on LittleFS (did you run uploadfs?): ");
    Serial.println(id);
    return;
  }
  tabyIsLooping = info->loopAnim;
  if (currentState != ST_TABY)
    stateBeforeTaby = currentState; // don't clobber it on taby->taby switches
  enterState(ST_TABY);
  Serial.print("✅ TABY → ");
  Serial.println(id);
}

// Picks a random *one-shot* reaction (never an ambient loop — this is meant
// to be a brief "huh, cute" pop-up on top of whatever ambient state the app
// last set, not a lasting state change). Built once on first call, not per
// call, since TABY_REGISTRY never changes at runtime.
const char *pickRandomTabyReaction()
{
  static const char *oneShotIds[TABY_REGISTRY_COUNT];
  static int oneShotCount = -1;
  if (oneShotCount < 0)
  {
    oneShotCount = 0;
    for (size_t i = 0; i < TABY_REGISTRY_COUNT; i++)
      if (!TABY_REGISTRY[i].loopAnim)
        oneShotIds[oneShotCount++] = TABY_REGISTRY[i].id;
  }
  if (oneShotCount == 0)
    return nullptr;
  return oneShotIds[random(oneShotCount)];
}

// Randomized, not fixed-interval (unlike pollSensorAutoShow()) — rerolled
// every time it fires, so it doesn't fall into an obvious metronomic
// pattern. 3-10 minutes, same ballpark as the climate auto-show.
const unsigned long TABY_RANDOM_MIN_MS = 180000UL; // 3 min
const unsigned long TABY_RANDOM_MAX_MS = 600000UL; // 10 min
unsigned long lastTabyRandomAtMs = 0;
unsigned long nextTabyRandomIntervalMs = 0;

// Non-blocking — called every loop() iteration. Independent of the app's
// own window-tracking animation picks (idle/focus/relax/love/error) and of
// deliberate #TABY: triggers — this is the device doing something on its
// own, at a random moment, for no reason other than being alive. Only fires
// while an ambient/idle-ish state is already showing (never interrupts
// Pomodoro/Claude/Notify/Climate/an already-running Taby reaction/startup).
void pollTabyRandomShow()
{
  if (pomoLocked)
    return;
  if (currentState == ST_STARTUP || currentState == ST_POMO_WORK || currentState == ST_POMO_BREAK ||
      currentState == ST_POMO_LONGBREAK || currentState == ST_CLAUDE || currentState == ST_NOTIFY ||
      currentState == ST_SENSOR || currentState == ST_TABY)
    return;

  if (nextTabyRandomIntervalMs == 0)
  {
    // First run after boot — just arm the timer, don't fire immediately.
    lastTabyRandomAtMs = millis();
    nextTabyRandomIntervalMs = random(TABY_RANDOM_MIN_MS, TABY_RANDOM_MAX_MS);
    return;
  }
  if (millis() - lastTabyRandomAtMs < nextTabyRandomIntervalMs)
    return;

  const char *id = pickRandomTabyReaction();
  if (id)
    playTabyAnimation(id);

  lastTabyRandomAtMs = millis();
  nextTabyRandomIntervalMs = random(TABY_RANDOM_MIN_MS, TABY_RANDOM_MAX_MS);
}
