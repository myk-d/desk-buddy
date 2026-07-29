# Claude Code integration

Gaze Buddy can show live Claude Code status and usage on its screen: a dedicated
full-screen view that turns blue while Claude is working, green when a task
finishes, and red when Claude needs your input — plus two progress bars for
your 5-hour session limit and 7-day weekly limit.

## Setup (one-time, per computer)

1. Make sure [Claude Code](https://code.claude.com) is installed and you've
   used it at least once (so `~/.claude/` exists).
2. Open **Gaze Buddy Hub** → **Device** page.
3. Under "Claude Code," click **Setup Claude Code integration**.

That's it — no manual file editing. The button writes a few small scripts to
`~/.claude/hooks/` and registers them in `~/.claude/settings.json`. If you ever
move Gaze Buddy Hub to a different computer, repeat step 3 there — the status
on the Device page will show "not configured" as a reminder.

## What you'll see, and where

| Signal | Where it works | Notes |
|---|---|---|
| Working / Done / Needs input | Terminal **and** the VS Code extension | Fires from any Claude Code session — hooks are shared across front-ends. |
| Session (5h) / Weekly (7d) usage bars | **Terminal only** | The VS Code extension has no terminal status line to render this from, so the bars won't populate from an extension-only session. Open Claude Code in a regular terminal at least once. |

Usage bars also require a **Claude Pro or Max** subscription — API-key /
pay-as-you-go usage isn't rate-limited this way, so the bars stay at `--`.

## How it works (for reference)

- Three hooks (`PreToolUse`, `Stop`, `Notification`) POST a simple state
  (`working` / `done` / `waiting`) to `http://127.0.0.1:7842`, a small HTTP
  server the desktop app runs locally.
- A `statusLine` command receives Claude Code's own rate-limit data
  (`rate_limits.five_hour` / `seven_day`) on every terminal status-line render
  and forwards it the same way.
- The desktop app is a thin relay — it doesn't decide what to display. It just
  forwards the raw signal to the device over serial as `#CLAUDE:<state>` and
  `#USAGE:<5h%>,<7d%>`. The firmware itself owns the actual screen and choice
  of colors/animation.

## Troubleshooting

- **Nothing shows up on the device**: confirm the desktop app is running the
  latest build (Electron's main process needs a full restart after an update,
  not just a reload) and the device firmware is up to date (Device page →
  Firmware section).
- **Hooks don't seem to fire**: run `/hooks` inside a Claude Code session to
  confirm they're registered. Config changes to `~/.claude/settings.json` are
  picked up automatically — no restart needed.
- **Usage bars stay empty**: check you're testing from a plain terminal
  session, not the VS Code extension, and that you're on a Pro/Max plan.
