// One consistent 500/600-weight tone per button so each reads as a distinct
// color at a glance — WORKING reuses the same brand purple as the Claude
// Code "working" indicator elsewhere in the app (DevicePage's STATE_COLOR),
// since both represent the same idea (actively focused).
export const COMMANDS = [
	{ label: 'IDLE',    packet: '#ANIM:idle\n',  mode: 'IDLE',    bg: '#78716c' }, // stone-500
	{ label: 'RELAX',   packet: '#ANIM:relax\n', mode: 'RELAX',   bg: '#0ea5e9' }, // sky-500
	{ label: 'WORKING', packet: '#ANIM:focus\n', mode: 'WORKING', bg: '#a855f7' }, // brand-500
	{ label: 'SUCCESS', packet: '#ANIM:love\n',  mode: 'SUCCESS', bg: '#16a34a' }, // green-600
	{ label: 'ERROR',   packet: '#ANIM:error\n', mode: 'ERROR',   bg: '#dc2626' }, // red-600
	{ label: 'CLIMATE', packet: '#ANIM:sensor\n', mode: 'CLIMATE', bg: '#0891b2' }, // cyan-600
] as const;

export const ANIM_MODE_MAP: Record<string, string> = {
	'#ANIM:idle':      'IDLE',
	'#ANIM:focus':     'WORKING',
	'#ANIM:relax':     'RELAX',
	'#ANIM:love':      'SUCCESS',
	'#ANIM:error':     'ERROR',
	'#ANIM:sensor':    'CLIMATE',
	'#ANIM:pomowork':  'POMO · FOCUS',
	'#ANIM:pomobreak': 'POMO · BREAK',
	'#ANIM:pomolongbreak': 'POMO · LONG BREAK',
};

// All 84 "bonus" Taby character animations (#TABY:<id>, see
// ../firmware/CLAUDE.md), grouped the same way firmware/src/taby_registry.h
// conceptually groups them. One button each (TabyPicker.tsx) with a search
// box on top — generated from the actual registry ids, not hand-typed, so
// this can't silently drift out of sync with what the firmware supports.
export const TABY_CATEGORIES: { category: string; items: { id: string; label: string }[] }[] = [
	{ category: 'Emotions', items: [
		{ id: 'angry_01_loop', label: 'Angry 01 (loop)' },
		{ id: 'angry_02_loop', label: 'Angry 02 (loop)' },
		{ id: 'blush', label: 'Blush' },
		{ id: 'disappointed', label: 'Disappointed' },
		{ id: 'hello_annoyed', label: 'Hello Annoyed' },
		{ id: 'hello_disappointed', label: 'Hello Disappointed' },
		{ id: 'no', label: 'No' },
		{ id: 'thumbs_up', label: 'Thumbs Up' },
		{ id: 'trophy', label: 'Trophy' },
		{ id: 'wow', label: 'Wow' },
		{ id: 'yeah', label: 'Yeah' },
		{ id: 'confirmation', label: 'Confirmation' },
		{ id: 'review', label: 'Review' },
		{ id: 'love_01', label: 'Love' },
	] },
	{ category: 'Games & fun', items: [
		{ id: 'basketball_dunk', label: 'Basketball Dunk' },
		{ id: 'basketball_throw', label: 'Basketball Throw' },
		{ id: 'boxing', label: 'Boxing' },
		{ id: 'f1_car', label: 'F1 Car' },
		{ id: 'fishing_long', label: 'Fishing (long)' },
		{ id: 'fishing_short', label: 'Fishing (short)' },
		{ id: 'circle', label: 'Circle' },
		{ id: 'square', label: 'Square' },
	] },
	{ category: 'Work & focus', items: [
		{ id: 'working_in', label: 'Working (start)' },
		{ id: 'working_loop', label: 'Working (loop)' },
		{ id: 'working_laptop_in', label: 'Working Laptop (start)' },
		{ id: 'working_laptop_loop', label: 'Working Laptop (loop)' },
		{ id: 'working_laptop_bored_loop', label: 'Working Laptop Bored (loop)' },
		{ id: 'working_laptop_excited_loop', label: 'Working Laptop Excited (loop)' },
		{ id: 'working_laptop_normal_loop', label: 'Working Laptop Normal (loop)' },
		{ id: 'lockin', label: 'Lock In' },
		{ id: 'posture_check', label: 'Posture Check' },
		{ id: 'busy_loop', label: 'Busy (loop)' },
		{ id: 'copy_paste', label: 'Copy Paste' },
		{ id: 'workspaces_in', label: 'Workspaces (start)' },
		{ id: 'workspaces_loop', label: 'Workspaces (loop)' },
		{ id: 'searching_loop', label: 'Searching (loop)' },
		{ id: 'calm_work_low_f000', label: 'Calm Work Low' },
		{ id: 'calm_work_medium_f000', label: 'Calm Work Medium' },
		{ id: 'calm_work_high_f000', label: 'Calm Work High' },
	] },
	{ category: 'AI assistants', items: [
		{ id: 'claude_in', label: 'Claude (start)' },
		{ id: 'claude_loop', label: 'Claude (loop)' },
		{ id: 'codex_in', label: 'Codex (start)' },
		{ id: 'codex_loop', label: 'Codex (loop)' },
		{ id: 'taby_response_ready_in', label: 'Response Ready (start)' },
		{ id: 'taby_response_ready_loop', label: 'Response Ready (loop)' },
		{ id: 'waiting_01', label: 'Waiting' },
	] },
	{ category: 'Break & relax', items: [
		{ id: 'break_start', label: 'Break Start' },
		{ id: 'relaxing_01_loop', label: 'Relaxing (loop)' },
		{ id: 'relaxing_couch_in', label: 'Relaxing Couch (start)' },
		{ id: 'relaxing_couch_loop', label: 'Relaxing Couch (loop)' },
		{ id: 'stretching', label: 'Stretching' },
		{ id: 'drink_water', label: 'Drink Water' },
		{ id: 'sleeping_loop', label: 'Sleeping (loop)' },
		{ id: 'flower_grow', label: 'Flower Grow' },
	] },
	{ category: 'Tasks & calendar', items: [
		{ id: 'calendar_in', label: 'Calendar (start)' },
		{ id: 'calendar_loop', label: 'Calendar (loop)' },
		{ id: 'creating_task_loop', label: 'Creating Task (loop)' },
		{ id: 'task_completed', label: 'Task Completed' },
		{ id: 'task_created', label: 'Task Created' },
		{ id: 'task_page', label: 'Task Page' },
		{ id: 'delete_01', label: 'Delete' },
		{ id: 'day_planned', label: 'Day Planned' },
		{ id: 'perfect_day_01', label: 'Perfect Day 01' },
		{ id: 'perfect_day_01_simple', label: 'Perfect Day 01 (simple)' },
		{ id: 'perfect_day_02', label: 'Perfect Day 02' },
		{ id: 'perfect_day_03', label: 'Perfect Day 03' },
	] },
	{ category: 'Voice & chat', items: [
		{ id: 'listening_in', label: 'Listening (start)' },
		{ id: 'listening_loop', label: 'Listening (loop)' },
		{ id: 'listening_music_loop', label: 'Listening Music (loop)' },
		{ id: 'talking_default_loop', label: 'Talking (loop)' },
	] },
	{ category: 'Idle variations', items: [
		{ id: 'idle_01_loop', label: 'Idle 01 (loop)' },
		{ id: 'idle_02_loop', label: 'Idle 02 (loop)' },
		{ id: 'idle_variation_loop', label: 'Idle Variation (loop)' },
		{ id: 'calm_idle_01_f000', label: 'Calm Idle (frame 000)' },
		{ id: 'calm_idle_01_f137', label: 'Calm Idle (frame 137)' },
		{ id: 'calm_idle_01_f137_to_f177', label: 'Calm Idle (137→177)' },
		{ id: 'calm_idle_01_f177', label: 'Calm Idle (frame 177)' },
		{ id: 'calm_idle_01_f177_to_f216', label: 'Calm Idle (177→216)' },
		{ id: 'calm_idle_01_f216', label: 'Calm Idle (frame 216)' },
		{ id: 'calm_idle_01_to_f137', label: 'Calm Idle (000→137)' },
	] },
	{ category: 'Digital wellbeing', items: [
		{ id: 'turn_off_reddit', label: 'Turn Off Reddit' },
		{ id: 'turn_off_scroll', label: 'Turn Off Scroll' },
		{ id: 'turn_off_tv', label: 'Turn Off TV' },
	] },
	{ category: 'System', items: [
		{ id: 'startup', label: 'Startup' },
	] },
];
