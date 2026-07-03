import type { CSSProperties } from 'react';
import type { Phase } from '../hooks/usePomodoroRunner';
import type { PomodoroPreset } from '../types';
import { colors } from '../theme';

interface Props {
	preset: PomodoroPreset;
	phase: Phase;
	running: boolean;
	secondsLeft: number;
	currentSession: number;
	connected: boolean;
	onPause: () => void;
	onResume: () => void;
	onReset: () => void;
	onBackToList: () => void;
}

function fmt(s: number) {
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const PHASE_COLOR: Record<Phase, string> = {
	idle: colors.textMuted,
	work: colors.accent,
	'short-break': colors.successBright,
	done: colors.success,
};

const PHASE_LABEL: Record<Phase, string> = {
	idle: 'Ready',
	work: 'Focus',
	'short-break': 'Break',
	done: 'Done!',
};

export function PomodoroRunner({
	preset, phase, running, secondsLeft, currentSession, connected,
	onPause, onResume, onReset, onBackToList,
}: Props) {
	const color = PHASE_COLOR[phase];
	const totalSecs = phase === 'short-break' ? preset.breakMin * 60 : preset.workMin * 60;
	const progress = phase === 'idle' || phase === 'done' ? 1 : secondsLeft / totalSecs;
	const R = 90;
	const C = 2 * Math.PI * R;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '680px' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
				<div>
					<h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>Pomodoro Timer</h1>
					<p style={{ color: colors.textMuted, margin: '6px 0 0', fontSize: '16px' }}>{preset.name}</p>
				</div>
				<button onClick={onBackToList} style={ghostButtonStyle}>
					Back to list
				</button>
			</div>

			<div style={{ display: 'flex', justifyContent: 'center' }}>
				<div style={{ position: 'relative', width: '220px', height: '220px' }}>
					<svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
						<circle cx="110" cy="110" r={R} fill="none" stroke={colors.surface} strokeWidth="12" />
						<circle
							cx="110" cy="110" r={R} fill="none"
							stroke={color} strokeWidth="12" strokeLinecap="round"
							strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
							style={{ transition: 'stroke-dashoffset 0.8s linear, stroke 0.4s ease' }}
						/>
					</svg>
					<div style={{
						position: 'absolute', top: '50%', left: '50%',
						transform: 'translate(-50%, -50%)', textAlign: 'center',
					}}>
						<div style={{ fontSize: '40px', fontWeight: 'bold', fontFamily: 'monospace', color }}>
							{fmt(secondsLeft)}
						</div>
						<div style={{ fontSize: '13px', color: colors.textMuted, marginTop: '4px' }}>
							{PHASE_LABEL[phase]}
							{phase !== 'idle' && phase !== 'done' && ` · ${currentSession}/${preset.sessions}`}
						</div>
					</div>
				</div>
			</div>

			{phase === 'done' && (
				<div style={{ textAlign: 'center', fontSize: '15px', color: colors.success }}>
					All {preset.sessions} sessions completed!
				</div>
			)}

			<div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
				{!running && phase !== 'done' && (
					<button
						disabled={!connected}
						onClick={onResume}
						style={{
							padding: '12px 36px', borderRadius: '8px', border: 'none',
							backgroundColor: connected ? color : colors.border,
							color: colors.bg, fontSize: '15px', fontWeight: 'bold',
							cursor: connected ? 'pointer' : 'not-allowed',
						}}
					>
						Resume
					</button>
				)}
				{running && (
					<button
						onClick={onPause}
						style={{
							padding: '12px 36px', borderRadius: '8px', border: `1px solid ${colors.textDisabled}`,
							backgroundColor: 'transparent', color: colors.textPrimary,
							fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
						}}
					>
						Pause
					</button>
				)}
				<button onClick={onReset} style={ghostButtonStyle}>
					Stop
				</button>
			</div>
		</div>
	);
}

const ghostButtonStyle: CSSProperties = {
	padding: '10px 20px',
	borderRadius: '8px',
	border: `1px solid ${colors.border}`,
	backgroundColor: 'transparent',
	color: colors.textFaint,
	fontSize: '14px',
	cursor: 'pointer',
};
