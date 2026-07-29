import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRemoteValue } from './useRemoteValue';
import { useRemoteCollection } from './useRemoteCollection';
import { normalizeStatsForToday, genId } from '../lib/utils';
import type { PomodoroPhase, PomodoroPreset, PomodoroSettings, PomodoroStats } from '../types';

const DEFAULT_SETTINGS: PomodoroSettings = {
	focusMinutes: 25,
	shortBreakMinutes: 5,
	longBreakMinutes: 15,
	sessionsBeforeLongBreak: 4,
	autoStartNext: true,
};

const DEFAULT_STATS: PomodoroStats = {
	todayDate: '',
	todaySessions: 0,
	todayFocusMinutes: 0,
	totalSessions: 0,
	totalFocusMinutes: 0,
};

function durationFor(phase: PomodoroPhase, settings: PomodoroSettings): number {
	if (phase === 'focus') return settings.focusMinutes * 60;
	if (phase === 'shortBreak') return settings.shortBreakMinutes * 60;
	return settings.longBreakMinutes * 60;
}

// Device-facing animation per phase — the physical screen mirrors whatever
// phase the timer is in, same convention as the old work/break-only model
// (see firmware/src/main.cpp's ST_POMO_WORK/BREAK/LONGBREAK).
const ANIM_FOR_PHASE: Record<PomodoroPhase, string> = {
	focus: '#ANIM:pomowork\n',
	shortBreak: '#ANIM:pomobreak\n',
	longBreak: '#ANIM:pomolongbreak\n',
};

export function usePomodoro(sendPacket: (packet: string) => void) {
	const [settings, setSettings] = useRemoteValue<PomodoroSettings>(window.api.pomodoroSettings, DEFAULT_SETTINGS);
	const [rawStats, setStats] = useRemoteValue<PomodoroStats>(window.api.pomodoroStats, DEFAULT_STATS);
	// Derived rather than stored, so the "today" counters always read correctly
	// the instant a new day starts, without needing a hydration-timing dance.
	const stats = useMemo(() => normalizeStatsForToday(rawStats), [rawStats]);

	const [phase, setPhase] = useState<PomodoroPhase>('focus');
	const [rawTimeLeft, setRawTimeLeft] = useState(() => durationFor('focus', settings));
	const [isActive, setIsActive] = useState(false);
	// Whether the current phase's countdown has ever been engaged. While false,
	// the displayed time tracks live settings (so e.g. editing settings updates
	// the idle display immediately) instead of being frozen at whatever it was.
	const [started, setStarted] = useState(false);
	const [sessionsInCycle, setSessionsInCycle] = useState(0);
	const [flashKey, setFlashKey] = useState(0);
	const [activeTaskId, setActiveTask] = useState<string | null>(null);
	// Tracks whether at least one focus session has completed during the
	// current run — gates linked-task completion in reset() so stopping
	// immediately after starting doesn't mark the task done for no work done.
	const [completedAnySession, setCompletedAnySession] = useState(false);
	const [presets, setPresets] = useRemoteCollection<PomodoroPreset>(window.api.pomodoroPresets);
	const [activePresetId, setActivePresetId] = useState<string | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const sendRef = useRef(sendPacket);
	sendRef.current = sendPacket;

	const timeLeft = started ? rawTimeLeft : durationFor(phase, settings);

	const completePhase = () => {
		setFlashKey((k) => k + 1);
		if (phase === 'focus') {
			setStats((prev) => {
				const normalized = normalizeStatsForToday(prev);
				return {
					...normalized,
					todaySessions: normalized.todaySessions + 1,
					todayFocusMinutes: normalized.todayFocusMinutes + settings.focusMinutes,
					totalSessions: normalized.totalSessions + 1,
					totalFocusMinutes: normalized.totalFocusMinutes + settings.focusMinutes,
				};
			});
			setCompletedAnySession(true);
			const nextCount = sessionsInCycle + 1;
			setSessionsInCycle(nextCount);
			const nextPhase: PomodoroPhase = nextCount % settings.sessionsBeforeLongBreak === 0 ? 'longBreak' : 'shortBreak';
			setPhase(nextPhase);
			setRawTimeLeft(durationFor(nextPhase, settings));
			sendRef.current(ANIM_FOR_PHASE[nextPhase]);
		} else {
			// A long break finishing marks the end of a cycle — the session-count
			// dots should clear for the new one. A short break finishing is still
			// mid-cycle, so sessionsInCycle stays as-is.
			if (phase === 'longBreak') setSessionsInCycle(0);
			setPhase('focus');
			setRawTimeLeft(durationFor('focus', settings));
			sendRef.current(ANIM_FOR_PHASE.focus);
		}
		setStarted(settings.autoStartNext);
		setIsActive(settings.autoStartNext);
	};

	// Interval tick only ever calls setState from inside this callback, never
	// synchronously in the effect body; the effect re-arms every second because
	// `rawTimeLeft` is a dependency, so the closure (and `completePhase`) stays fresh.
	useEffect(() => {
		if (!isActive || rawTimeLeft <= 0) return;
		timerRef.current = setInterval(() => {
			if (rawTimeLeft <= 1) {
				completePhase();
				return;
			}
			setRawTimeLeft(rawTimeLeft - 1);
		}, 1000);
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
		// completePhase intentionally excluded: it's redefined every render and only
		// needs to be fresh at the moment the interval fires, which it already is.
		// Adding it here would re-arm the interval on every render, not just each tick.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isActive, rawTimeLeft]);

	// Device countdown display — pushes the live seconds-left to the firmware
	// every tick while a phase is actively running (see firmware's #TIME:
	// handler, which only applies it while in a pomodoro state).
	useEffect(() => {
		if (!isActive) return;
		sendRef.current(`#TIME:${rawTimeLeft}:${durationFor(phase, settings)}\n`);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [rawTimeLeft, isActive, phase]);

	// `startForTask` is consumed far from the Pomodoro page itself (every
	// TaskRow, TaskDetailPanel — via a narrower context) specifically so those
	// components don't re-render every second the timer ticks. That only
	// works if `startForTask` (and `start`, which it calls) is referentially
	// stable across renders — reading `timeLeft`/`phase` through refs instead
	// of closing over them directly lets `start` stay a stable `useCallback`
	// with an empty dep array while still using the latest values.
	const timeLeftRef = useRef(timeLeft);
	useEffect(() => {
		timeLeftRef.current = timeLeft;
	}, [timeLeft]);
	const phaseRef = useRef(phase);
	useEffect(() => {
		phaseRef.current = phase;
	}, [phase]);
	const start = useCallback(() => {
		setRawTimeLeft(timeLeftRef.current);
		setStarted(true);
		setIsActive(true);
		window.api.setPomodoroActive(true);
		sendRef.current(ANIM_FOR_PHASE[phaseRef.current]);
	}, []);
	const pause = () => setIsActive(false);
	const toggle = () => (isActive ? pause() : start());
	const reset = () => {
		setIsActive(false);
		setStarted(false);
		window.api.setPomodoroActive(false);
		sendRef.current('#ANIM:idle\n');
		if (completedAnySession) {
			const preset = presets.find((p) => p.id === activePresetId);
			if (preset?.linkedTaskId) {
				void window.api.tasks.update(preset.linkedTaskId, { completed: true });
			}
		}
		setActiveTask(null);
		setActivePresetId(null);
		setCompletedAnySession(false);
	};
	const startForTask = useCallback(
		(taskId: string) => {
			setActiveTask(taskId);
			start();
		},
		[start]
	);

	// Applies a preset's durations directly rather than going through start()
	// (which derives `timeLeft` from the *current* `settings`/`phase` closure —
	// reading that right after setSettings()/setPhase() in the same call would
	// still see the pre-update values, since React hasn't re-rendered yet).
	const runPreset = (presetId: string) => {
		const preset = presets.find((p) => p.id === presetId);
		if (!preset) return;
		const nextSettings: PomodoroSettings = {
			focusMinutes: preset.focusMinutes,
			shortBreakMinutes: preset.shortBreakMinutes,
			longBreakMinutes: preset.longBreakMinutes,
			sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
			autoStartNext: preset.autoStartNext,
		};
		setSettings(nextSettings);
		setPhase('focus');
		setSessionsInCycle(0);
		setRawTimeLeft(durationFor('focus', nextSettings));
		setStarted(true);
		setIsActive(true);
		setActivePresetId(presetId);
		setCompletedAnySession(false);
		window.api.setPomodoroActive(true);
		sendRef.current(ANIM_FOR_PHASE.focus);
	};

	const addPreset = (preset: Omit<PomodoroPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
		const now = Date.now();
		setPresets((prev) => [...prev, { ...preset, id: genId(), createdAt: now, updatedAt: now }]);
	};
	const updatePreset = (id: string, patch: Partial<Omit<PomodoroPreset, 'id'>>) => {
		setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)));
	};
	const deletePreset = (id: string) => {
		setPresets((prev) => prev.filter((p) => p.id !== id));
		if (activePresetId === id) setActivePresetId(null);
	};
	const skip = () => {
		if (phase === 'focus') {
			const nextCount = sessionsInCycle + 1;
			setSessionsInCycle(nextCount);
			const nextPhase: PomodoroPhase = nextCount % settings.sessionsBeforeLongBreak === 0 ? 'longBreak' : 'shortBreak';
			setPhase(nextPhase);
			sendRef.current(ANIM_FOR_PHASE[nextPhase]);
		} else {
			if (phase === 'longBreak') setSessionsInCycle(0);
			setPhase('focus');
			sendRef.current(ANIM_FOR_PHASE.focus);
		}
		setIsActive(false);
		setStarted(false);
	};

	const updateSettings = (patch: Partial<PomodoroSettings>) => setSettings((prev) => ({ ...prev, ...patch }));

	const totalSeconds = durationFor(phase, settings);
	const progress = totalSeconds === 0 ? 0 : 1 - timeLeft / totalSeconds;

	return {
		settings,
		updateSettings,
		stats,
		phase,
		timeLeft,
		totalSeconds,
		progress,
		isActive,
		sessionsInCycle,
		flashKey,
		activeTaskId,
		setActiveTask,
		presets,
		activePresetId,
		runPreset,
		addPreset,
		updatePreset,
		deletePreset,
		start,
		startForTask,
		pause,
		toggle,
		reset,
		skip,
	};
}

export type Pomodoro = ReturnType<typeof usePomodoro>;
