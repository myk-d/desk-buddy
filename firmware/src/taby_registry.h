#pragma once

// Auto-generated — DO NOT EDIT MANUALLY. One row per Taby "bonus"
// animation: just the id + whether it's an ambient loop or a one-shot
// reaction. The actual GIF data lives on LittleFS (data/taby/<id>.gif,
// see taby_gif_player.h) — nothing here is baked into the binary.

struct TabyAnimInfo
{
  const char *id;
  bool loopAnim;
};

static const TabyAnimInfo TABY_REGISTRY[] = {
  {"angry_01_loop", true},
  {"angry_02_loop", true},
  {"basketball_dunk", false},
  {"basketball_throw", false},
  {"blush", false},
  {"boxing", false},
  {"break_start", false},
  {"busy_loop", true},
  {"calendar_in", false},
  {"calendar_loop", true},
  {"circle", false},
  {"claude_in", false},
  {"claude_loop", true},
  {"codex_in", false},
  {"codex_loop", true},
  {"confirmation", false},
  {"copy_paste", false},
  {"creating_task_loop", true},
  {"day_planned", false},
  {"delete_01", false},
  {"disappointed", false},
  {"drink_water", false},
  {"f1_car", false},
  {"fishing_long", false},
  {"fishing_short", false},
  {"flower_grow", false},
  {"hello_annoyed", false},
  {"hello_disappointed", false},
  {"idle_01_loop", true},
  {"calm_idle_01_f000", true},
  {"calm_idle_01_to_f137", false},
  {"calm_idle_01_f137", true},
  {"calm_idle_01_f137_to_f177", false},
  {"calm_idle_01_f177", true},
  {"calm_idle_01_f177_to_f216", false},
  {"calm_idle_01_f216", true},
  {"calm_work_low_f000", true},
  {"calm_work_medium_f000", true},
  {"calm_work_high_f000", true},
  {"idle_02_loop", true},
  {"idle_variation_loop", true},
  {"listening_in", false},
  {"listening_loop", true},
  {"listening_music_loop", true},
  {"lockin", false},
  {"love_01", false},
  {"no", false},
  {"perfect_day_01", false},
  {"perfect_day_01_simple", false},
  {"perfect_day_02", false},
  {"perfect_day_03", false},
  {"posture_check", false},
  {"relaxing_01_loop", true},
  {"relaxing_couch_in", false},
  {"relaxing_couch_loop", true},
  {"review", false},
  {"searching_loop", true},
  {"sleeping_loop", true},
  {"square", false},
  {"startup", false},
  {"stretching", false},
  {"talking_default_loop", true},
  {"taby_response_ready_in", false},
  {"taby_response_ready_loop", true},
  {"task_completed", false},
  {"task_created", false},
  {"task_page", false},
  {"thumbs_up", false},
  {"trophy", false},
  {"turn_off_reddit", false},
  {"turn_off_scroll", false},
  {"turn_off_tv", false},
  {"waiting_01", false},
  {"working_in", false},
  {"working_loop", true},
  {"working_laptop_in", false},
  {"working_laptop_loop", true},
  {"working_laptop_bored_loop", true},
  {"working_laptop_excited_loop", true},
  {"working_laptop_normal_loop", true},
  {"workspaces_in", false},
  {"workspaces_loop", true},
  {"wow", false},
  {"yeah", false},
};

#define TABY_REGISTRY_COUNT (sizeof(TABY_REGISTRY) / sizeof(TABY_REGISTRY[0]))

const TabyAnimInfo *findTabyAnimation(const char *id)
{
  for (size_t i = 0; i < TABY_REGISTRY_COUNT; i++)
    if (strcmp(TABY_REGISTRY[i].id, id) == 0)
      return &TABY_REGISTRY[i];
  return nullptr;
}
