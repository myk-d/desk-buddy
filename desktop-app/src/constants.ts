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

// A small sampler of the ~84 "bonus" Taby character animations (#TABY:<id>,
// see ../firmware/CLAUDE.md) — not an exhaustive picker (84 buttons would be
// unusable here), just enough variety to try the feature. Any of the 84 ids
// in firmware/src/taby_registry.h works over serial even without a button.
export const TABY_COMMANDS = [
	{ label: 'Thumbs up', id: 'thumbs_up' },
	{ label: 'Wow', id: 'wow' },
	{ label: 'Trophy', id: 'trophy' },
	{ label: 'No', id: 'no' },
	{ label: 'Boxing', id: 'boxing' },
	{ label: 'Basketball', id: 'basketball_dunk' },
	{ label: 'Fishing', id: 'fishing_long' },
	{ label: 'Stretching', id: 'stretching' },
	{ label: 'Drink water', id: 'drink_water' },
	{ label: 'F1 car', id: 'f1_car' },
] as const;
