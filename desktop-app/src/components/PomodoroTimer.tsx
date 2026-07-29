import { useState } from 'react';
import { Pause, Play, RotateCcw, Settings, SkipForward, Target, X } from 'lucide-react';
import { usePomodoroContext } from '../context/PomodoroContext';
import { useTaskStoreContext } from '../context/TaskStoreContext';
import { PomodoroSettingsPanel } from './PomodoroSettingsPanel';
import { PHASE_META, formatTime } from '../lib/utils';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = 208;

export function PomodoroTimer() {
	const {
		phase,
		timeLeft,
		progress,
		isActive,
		settings,
		stats,
		sessionsInCycle,
		flashKey,
		activeTaskId,
		setActiveTask,
		presets,
		activePresetId,
		updateSettings,
		toggle,
		reset,
		skip,
	} = usePomodoroContext();
	const { tasks } = useTaskStoreContext();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const meta = PHASE_META[phase];
	const linkedTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : undefined;
	const activePreset = activePresetId ? presets.find((p) => p.id === activePresetId) : undefined;

	return (
		<div
			key={flashKey}
			className="flex flex-col items-center gap-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm animate-phase-flash"
		>
			<div className="flex w-full items-center justify-between">
				<div className="flex items-center gap-1.5">
					<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.soft} ${meta.text}`}>{meta.label}</span>
					{activePreset && (
						<span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
							{activePreset.name}
						</span>
					)}
				</div>
				<div className="relative">
					<button
						onClick={() => setSettingsOpen((v) => !v)}
						className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
						aria-label="Settings"
					>
						<Settings size={16} />
					</button>
					{settingsOpen && (
						<PomodoroSettingsPanel settings={settings} onUpdate={updateSettings} onClose={() => setSettingsOpen(false)} />
					)}
				</div>
			</div>

			{linkedTask && (
				<div className="flex w-full items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-500">
					<span className="flex min-w-0 items-center gap-1.5">
						<Target size={13} className="shrink-0 text-brand-500" />
						<span className="truncate">{linkedTask.text}</span>
					</span>
					<button onClick={() => setActiveTask(null)} className="shrink-0 text-stone-400 hover:text-red-500">
						<X size={13} />
					</button>
				</div>
			)}

			<div className="relative" style={{ width: SIZE, height: SIZE }}>
				<svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90">
					<circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={8} className="stroke-stone-100" />
					<circle
						cx={SIZE / 2}
						cy={SIZE / 2}
						r={RADIUS}
						fill="none"
						strokeWidth={8}
						strokeLinecap="round"
						className={`${meta.ring} transition-[stroke-dashoffset] duration-1000 ease-linear`}
						strokeDasharray={CIRCUMFERENCE}
						strokeDashoffset={CIRCUMFERENCE * progress}
					/>
				</svg>
				<div className="absolute inset-0 flex items-center justify-center font-mono text-3xl font-bold text-stone-800">
					{formatTime(timeLeft)}
				</div>
			</div>

			<div className="flex items-center gap-1">
				{(() => {
					const mod = sessionsInCycle % settings.sessionsBeforeLongBreak;
					const filled = sessionsInCycle > 0 && mod === 0 ? settings.sessionsBeforeLongBreak : mod;
					return Array.from({ length: settings.sessionsBeforeLongBreak }).map((_, i) => (
						<span key={i} className={`h-1.5 w-1.5 rounded-full ${i < filled ? 'bg-brand-500' : 'bg-stone-200'}`} />
					));
				})()}
			</div>

			<div className="flex items-center gap-2">
				<button
					onClick={toggle}
					className="flex items-center gap-1.5 rounded-full bg-brand-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-95"
				>
					{isActive ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
					{isActive ? 'Pause' : 'Start'}
				</button>
				<button
					onClick={reset}
					className="flex items-center gap-1.5 rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200"
				>
					<RotateCcw size={15} /> Reset
				</button>
				<button
					onClick={skip}
					className="flex items-center gap-1.5 rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200"
				>
					<SkipForward size={15} /> Next
				</button>
			</div>

			<div className="grid w-full grid-cols-2 gap-2 border-t border-stone-100 pt-4 text-center">
				<div>
					<div className="text-lg font-bold text-stone-800">{stats.todaySessions}</div>
					<div className="text-xs text-stone-400">Sessions today</div>
				</div>
				<div>
					<div className="text-lg font-bold text-stone-800">{stats.todayFocusMinutes} min</div>
					<div className="text-xs text-stone-400">Focus time today</div>
				</div>
				<div>
					<div className="text-lg font-bold text-stone-800">{stats.totalSessions}</div>
					<div className="text-xs text-stone-400">Total sessions</div>
				</div>
				<div>
					<div className="text-lg font-bold text-stone-800">{stats.totalFocusMinutes} min</div>
					<div className="text-xs text-stone-400">Total focus time</div>
				</div>
			</div>
		</div>
	);
}
