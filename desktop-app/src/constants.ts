export const COMMANDS = [
	{ label: 'IDLE',    packet: '#ANIM:idle\n',  mode: 'IDLE',    bg: '#334155', activeBg: '#334155' },
	{ label: 'RELAX',   packet: '#ANIM:relax\n', mode: 'RELAX',   bg: '#fff59a', activeBg: '#f3ff51' },
	{ label: 'WORKING', packet: '#ANIM:focus\n', mode: 'WORKING', bg: '#334155', activeBg: '#334155' },
	{ label: 'SUCCESS', packet: '#ANIM:love\n',  mode: 'SUCCESS', bg: '#16a34a', activeBg: '#15803d' },
	{ label: 'ERROR',   packet: '#ANIM:error\n', mode: 'ERROR',   bg: '#dc2626', activeBg: '#b91c1c' },
] as const;

export const ANIM_MODE_MAP: Record<string, string> = {
	'#ANIM:idle':      'IDLE',
	'#ANIM:focus':     'WORKING',
	'#ANIM:relax':     'RELAX',
	'#ANIM:love':      'SUCCESS',
	'#ANIM:error':     'ERROR',
	'#ANIM:pomowork':  'POMO · FOCUS',
	'#ANIM:pomobreak': 'POMO · BREAK',
};
