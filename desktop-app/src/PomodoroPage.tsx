import { useState, useEffect, useRef } from 'react';

type Phase = 'idle' | 'work' | 'short-break' | 'done';

interface Config {
	name: string;
	workMin: number;
	breakMin: number;
	sessions: number;
}

interface Props {
	connected: boolean;
	onCommand: (packet: string) => void;
}

function fmt(s: number) {
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const PHASE_COLOR: Record<Phase, string> = {
	idle: '#94a3b8',
	work: '#38bdf8',
	'short-break': '#4ade80',
	done: '#22c55e',
};

const PHASE_LABEL: Record<Phase, string> = {
	idle: 'Ready',
	work: 'Focus',
	'short-break': 'Break',
	done: 'Done!',
};

export function PomodoroPage({ connected, onCommand }: Props) {
	const [config, setConfig] = useState<Config>({
		name: 'Focus Session',
		workMin: 25,
		breakMin: 5,
		sessions: 4,
	});

	const [phase, setPhase] = useState<Phase>('idle');
	const [running, setRunning] = useState(false);
	const [secondsLeft, setSecondsLeft] = useState(config.workMin * 60);
	const [currentSession, setCurrentSession] = useState(1);
	const [phaseComplete, setPhaseComplete] = useState(false);

	const phaseRef = useRef(phase);
	const sessionRef = useRef(currentSession);
	const configRef = useRef(config);
	const onCmdRef = useRef(onCommand);

	phaseRef.current = phase;
	sessionRef.current = currentSession;
	configRef.current = config;
	onCmdRef.current = onCommand;

	useEffect(() => {
		if (phase === 'idle') setSecondsLeft(config.workMin * 60);
	}, [config.workMin, phase]);

	useEffect(() => {
		if (!running) return;
		const id = setInterval(() => {
			setSecondsLeft((prev) => {
				if (prev <= 1) {
					setPhaseComplete(true);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(id);
	}, [running]);

	useEffect(() => {
		if (!running) return;
		if (phase !== 'work' && phase !== 'short-break') return;
		const total = phase === 'work' ? config.workMin * 60 : config.breakMin * 60;
		onCmdRef.current(`#TIME:${secondsLeft}:${total}\n`);
	}, [secondsLeft, running, phase, config.workMin, config.breakMin]);

	useEffect(() => {
		if (!phaseComplete) return;
		setPhaseComplete(false);
		const cfg = configRef.current;
		const sess = sessionRef.current;
		const cur = phaseRef.current;

		if (cur === 'work') {
			if (sess >= cfg.sessions) {
				setPhase('done');
				setRunning(false);
				onCmdRef.current('#ANIM:love\n');
			} else {
				setPhase('short-break');
				setSecondsLeft(cfg.breakMin * 60);
				onCmdRef.current('#ANIM:pomobreak\n');
			}
		} else if (cur === 'short-break') {
			const next = sess + 1;
			setCurrentSession(next);
			sessionRef.current = next;
			setPhase('work');
			setSecondsLeft(cfg.workMin * 60);
			onCmdRef.current('#ANIM:pomowork\n');
		}
	}, [phaseComplete]);

	const start = () => {
		if (phase === 'idle' || phase === 'done') {
			setPhase('work');
			setCurrentSession(1);
			sessionRef.current = 1;
			setSecondsLeft(configRef.current.workMin * 60);
			onCommand('#ANIM:pomowork\n');
		}
		setRunning(true);
	};

	const reset = () => {
		setRunning(false);
		setPhase('idle');
		setCurrentSession(1);
		sessionRef.current = 1;
		setSecondsLeft(configRef.current.workMin * 60);
		onCommand('#ANIM:idle\n');
	};

	const locked = phase !== 'idle' && phase !== 'done';
	const color = PHASE_COLOR[phase];
	const totalSecs = phase === 'short-break' ? config.breakMin * 60 : config.workMin * 60;
	const progress = phase === 'idle' || phase === 'done' ? 1 : secondsLeft / totalSecs;
	const R = 90;
	const C = 2 * Math.PI * R;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '680px' }}>
			<div>
				<h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>Pomodoro Timer</h1>
				<p style={{ color: '#94a3b8', margin: '6px 0 0', fontSize: '16px' }}>{config.name}</p>
			</div>

			<div style={{ display: 'flex', justifyContent: 'center' }}>
				<div style={{ position: 'relative', width: '220px', height: '220px' }}>
					<svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
						<circle cx="110" cy="110" r={R} fill="none" stroke="#1e293b" strokeWidth="12" />
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
						<div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
							{PHASE_LABEL[phase]}
							{phase !== 'idle' && phase !== 'done' && ` · ${currentSession}/${config.sessions}`}
						</div>
					</div>
				</div>
			</div>

			{phase === 'done' && (
				<div style={{ textAlign: 'center', fontSize: '15px', color: '#22c55e' }}>
					All {config.sessions} sessions completed!
				</div>
			)}

			<div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
				{!running && phase !== 'done' && (
					<button
						disabled={!connected}
						onClick={start}
						style={{
							padding: '12px 36px', borderRadius: '8px', border: 'none',
							backgroundColor: connected ? color : '#334155',
							color: '#0f172a', fontSize: '15px', fontWeight: 'bold',
							cursor: connected ? 'pointer' : 'not-allowed',
						}}
					>
						{phase === 'idle' ? 'Start' : 'Resume'}
					</button>
				)}
				{running && (
					<button
						onClick={() => setRunning(false)}
						style={{
							padding: '12px 36px', borderRadius: '8px', border: '1px solid #475569',
							backgroundColor: 'transparent', color: '#f8fafc',
							fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
						}}
					>
						Pause
					</button>
				)}
				{phase !== 'idle' && (
					<button
						onClick={reset}
						style={{
							padding: '12px 24px', borderRadius: '8px',
							border: '1px solid #334155', backgroundColor: 'transparent',
							color: '#64748b', fontSize: '14px', cursor: 'pointer',
						}}
					>
						Reset
					</button>
				)}
			</div>

			<div style={{
				backgroundColor: '#1e293b', borderRadius: '12px',
				border: '1px solid #334155', padding: '24px',
				display: 'flex', flexDirection: 'column', gap: '16px',
			}}>
				<span style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
					Configuration
					{locked && <span style={{ color: '#334155', fontWeight: 'normal', textTransform: 'none', marginLeft: '8px' }}>· stop timer to edit</span>}
				</span>
				<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
					{([
						['Name', 'name', 'text', undefined, undefined],
						['Work (min)', 'workMin', 'number', 1, 120],
						['Break (min)', 'breakMin', 'number', 1, 60],
						['Sessions', 'sessions', 'number', 1, 12],
					] as const).map(([label, key, type, min, max]) => (
						<div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
							<label style={{ fontSize: '12px', color: '#64748b' }}>{label}</label>
							<input
								type={type}
								min={min}
								max={max}
								value={String(config[key])}
								disabled={locked}
								onChange={(e) => setConfig((p) => ({
									...p,
									[key]: type === 'number' ? Math.max(1, Number(e.target.value) || 1) : e.target.value,
								}))}
								style={{
									padding: '8px 12px', borderRadius: '6px',
									border: '1px solid #334155',
									backgroundColor: locked ? '#162032' : '#0f172a',
									color: locked ? '#475569' : '#f8fafc',
									fontSize: '14px', outline: 'none',
									width: '100%', boxSizing: 'border-box',
									cursor: locked ? 'not-allowed' : 'text',
								}}
							/>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
