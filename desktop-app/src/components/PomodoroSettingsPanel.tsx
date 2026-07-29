import { useRef } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { Switch } from './ui/Switch';
import { inputClass, popoverClass } from '../lib/ui';
import type { PomodoroSettings } from '../types';

interface PomodoroSettingsPanelProps {
	settings: PomodoroSettings;
	onUpdate: (patch: Partial<PomodoroSettings>) => void;
	onClose: () => void;
}

export function PomodoroSettingsPanel({ settings, onUpdate, onClose }: PomodoroSettingsPanelProps) {
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, onClose);

	const field = (label: string, key: keyof PomodoroSettings, min: number, max: number) => (
		<label className="flex items-center justify-between gap-2 py-1 text-sm text-stone-600">
			{label}
			<input
				type="number"
				min={min}
				max={max}
				value={settings[key] as number}
				onChange={(e) => onUpdate({ [key]: Math.max(min, Math.min(max, Number(e.target.value) || min)) })}
				className={`${inputClass} w-16 py-1 text-right`}
			/>
		</label>
	);

	return (
		<div ref={ref} className={`${popoverClass} absolute right-0 top-10 z-30 w-64 p-3`}>
			<div className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-400">Duration (min)</div>
			{field('Focus', 'focusMinutes', 1, 120)}
			{field('Short break', 'shortBreakMinutes', 1, 60)}
			{field('Long break', 'longBreakMinutes', 1, 60)}
			{field('Sessions before long break', 'sessionsBeforeLongBreak', 1, 12)}
			<div className="mt-2 flex items-center justify-between gap-2 border-t border-stone-100 pt-2 text-sm text-stone-600">
				Auto-start next phase
				<Switch checked={settings.autoStartNext} onChange={(v) => onUpdate({ autoStartNext: v })} />
			</div>
		</div>
	);
}
