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
] as const;

export const ANIM_MODE_MAP: Record<string, string> = {
	'#ANIM:idle':      'IDLE',
	'#ANIM:focus':     'WORKING',
	'#ANIM:relax':     'RELAX',
	'#ANIM:love':      'SUCCESS',
	'#ANIM:error':     'ERROR',
	'#ANIM:pomowork':  'POMO · FOCUS',
	'#ANIM:pomobreak': 'POMO · BREAK',
	'#ANIM:pomolongbreak': 'POMO · LONG BREAK',
};
