import type { PomodoroPhase, PomodoroStats } from '../types';

export function genId(): string {
	return crypto.randomUUID();
}

export function getLocalDateKey(d: Date): string {
	const year = d.getFullYear();
	const month = (d.getMonth() + 1).toString().padStart(2, '0');
	const day = d.getDate().toString().padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function normalizeStatsForToday(stats: PomodoroStats): PomodoroStats {
	const todayKey = getLocalDateKey(new Date());
	if (stats.todayDate === todayKey) return stats;
	return { ...stats, todayDate: todayKey, todaySessions: 0, todayFocusMinutes: 0 };
}

export function formatTime(totalSeconds: number): string {
	const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
	const secs = (totalSeconds % 60).toString().padStart(2, '0');
	return `${mins}:${secs}`;
}

export const PHASE_META: Record<PomodoroPhase, { label: string; ring: string; text: string; soft: string }> = {
	focus: { label: 'Focus', ring: 'stroke-brand-500', text: 'text-brand-700', soft: 'bg-brand-50' },
	shortBreak: { label: 'Short Break', ring: 'stroke-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50' },
	longBreak: { label: 'Long Break', ring: 'stroke-indigo-500', text: 'text-indigo-700', soft: 'bg-indigo-50' },
};
