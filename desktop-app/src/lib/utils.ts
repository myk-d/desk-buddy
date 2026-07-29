import dayjs from 'dayjs';
import type {
	CalendarEvent,
	Priority,
	PomodoroPhase,
	PomodoroStats,
	RecurrenceFreq,
	RecurrenceRule,
	Task,
	TagColor,
	Tag,
	GroupBy,
	SortBy,
} from '../types';

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

export function formatDueDate(dueDate: string): string {
	const [year, month, day] = dueDate.split('-').map(Number);
	const date = new Date(year, month - 1, day);
	const todayKey = getLocalDateKey(new Date());
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	if (dueDate === todayKey) return 'Today';
	if (dueDate === getLocalDateKey(tomorrow)) return 'Tomorrow';
	return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

export function isOverdue(dueDate: string): boolean {
	return dueDate < getLocalDateKey(new Date());
}

export function sortTasksForDisplay(tasks: Task[]): Task[] {
	return sortTasksBy(tasks, 'sequence', []);
}

export function sortTasksBy(tasks: Task[], sortBy: SortBy, tags: Tag[]): Task[] {
	const tagLabel = (t: Task) => tags.find((tg) => tg.id === t.tagIds[0])?.name ?? '';
	const compare: Record<SortBy, (a: Task, b: Task) => number> = {
		sequence: (a, b) => a.order - b.order,
		date: (a, b) => (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99'),
		createdAt: (a, b) => b.createdAt - a.createdAt,
		updatedAt: (a, b) => b.updatedAt - a.updatedAt,
		name: (a, b) => a.text.localeCompare(b.text),
		tag: (a, b) => tagLabel(a).localeCompare(tagLabel(b)),
		priority: (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority),
	};
	return [...tasks].sort((a, b) => Number(b.pinned) - Number(a.pinned) || compare[sortBy](a, b));
}

export interface TaskGroup {
	key: string;
	label: string;
	tasks: Task[];
}

function dateBucket(dueDate: string | null): { key: string; label: string; rank: number } {
	if (!dueDate) return { key: 'none', label: 'No date', rank: 5 };
	const todayKey = getLocalDateKey(new Date());
	if (dueDate < todayKey) return { key: 'overdue', label: 'Overdue', rank: 0 };
	if (dueDate === todayKey) return { key: 'today', label: 'Today', rank: 1 };
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	if (dueDate === getLocalDateKey(tomorrow)) return { key: 'tomorrow', label: 'Tomorrow', rank: 2 };
	const weekAhead = new Date();
	weekAhead.setDate(weekAhead.getDate() + 7);
	if (dueDate <= getLocalDateKey(weekAhead)) return { key: 'week', label: 'This week', rank: 3 };
	return { key: 'later', label: 'Later', rank: 4 };
}

export function groupTasksBy(tasks: Task[], groupBy: GroupBy, tags: Tag[]): TaskGroup[] {
	if (groupBy === 'sequence' || groupBy === 'none') {
		return [{ key: 'all', label: '', tasks }];
	}

	if (groupBy === 'priority') {
		return PRIORITY_ORDER.map((p) => ({
			key: p,
			label: PRIORITY_META[p].label,
			tasks: tasks.filter((t) => t.priority === p),
		})).filter((g) => g.tasks.length > 0);
	}

	if (groupBy === 'tag') {
		const tagGroups = tags
			.map((tag) => ({ key: tag.id, label: tag.name, tasks: tasks.filter((t) => t.tagIds.includes(tag.id)) }))
			.filter((g) => g.tasks.length > 0);
		const untagged = tasks.filter((t) => t.tagIds.length === 0);
		return untagged.length > 0 ? [...tagGroups, { key: 'none', label: 'Untagged', tasks: untagged }] : tagGroups;
	}

	if (groupBy === 'date') {
		const buckets = new Map<string, TaskGroup & { rank: number }>();
		tasks.forEach((t) => {
			const b = dateBucket(t.dueDate);
			if (!buckets.has(b.key)) buckets.set(b.key, { ...b, tasks: [] });
			buckets.get(b.key)!.tasks.push(t);
		});
		return [...buckets.values()].sort((a, b) => a.rank - b.rank);
	}

	// createdAt: bucket by calendar day, newest day first.
	const buckets = new Map<string, TaskGroup>();
	tasks.forEach((t) => {
		const key = getLocalDateKey(new Date(t.createdAt));
		if (!buckets.has(key)) buckets.set(key, { key, label: formatDueDate(key), tasks: [] });
		buckets.get(key)!.tasks.push(t);
	});
	return [...buckets.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export const GROUP_BY_ORDER: GroupBy[] = ['sequence', 'date', 'createdAt', 'tag', 'priority', 'none'];
export const SORT_BY_ORDER: SortBy[] = ['sequence', 'date', 'createdAt', 'updatedAt', 'name', 'tag', 'priority'];

export const GROUP_BY_META: Record<GroupBy, { label: string }> = {
	sequence: { label: 'Sequence' },
	date: { label: 'Date' },
	createdAt: { label: 'Created' },
	tag: { label: 'Tag' },
	priority: { label: 'Priority' },
	none: { label: 'None' },
};

export const SORT_BY_META: Record<SortBy, { label: string }> = {
	sequence: { label: 'Sequence' },
	date: { label: 'Date' },
	createdAt: { label: 'Created' },
	updatedAt: { label: 'Updated' },
	name: { label: 'Name' },
	tag: { label: 'Tag' },
	priority: { label: 'Priority' },
};

export function formatTime(totalSeconds: number): string {
	const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
	const secs = (totalSeconds % 60).toString().padStart(2, '0');
	return `${mins}:${secs}`;
}

export const PRIORITY_META: Record<Priority, { label: string; colorClass: string; dotClass: string }> = {
	high: { label: 'High', colorClass: 'text-red-500', dotClass: 'bg-red-500' },
	medium: { label: 'Medium', colorClass: 'text-amber-500', dotClass: 'bg-amber-500' },
	low: { label: 'Low', colorClass: 'text-blue-500', dotClass: 'bg-blue-500' },
	none: { label: 'None', colorClass: 'text-stone-400', dotClass: 'bg-stone-300' },
};

export const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low', 'none'];

export const PHASE_META: Record<PomodoroPhase, { label: string; ring: string; text: string; soft: string }> = {
	focus: { label: 'Focus', ring: 'stroke-brand-500', text: 'text-brand-700', soft: 'bg-brand-50' },
	shortBreak: { label: 'Short Break', ring: 'stroke-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50' },
	longBreak: { label: 'Long Break', ring: 'stroke-indigo-500', text: 'text-indigo-700', soft: 'bg-indigo-50' },
};

export const TAG_COLOR_ORDER: TagColor[] = ['rose', 'amber', 'emerald', 'sky', 'violet', 'stone'];

// `wash` is a ~10%-opacity tint of the same hue — used for all-day events
// specifically (chip and full cell/column background), distinct from the
// muted `bg` swatch regular timed-event chips use.
export const TAG_COLOR_META: Record<TagColor, { bg: string; text: string; dot: string; wash: string }> = {
	rose: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500', wash: 'bg-rose-500/10' },
	amber: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', wash: 'bg-amber-500/10' },
	emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', wash: 'bg-emerald-500/10' },
	sky: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500', wash: 'bg-sky-500/10' },
	violet: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', wash: 'bg-violet-500/10' },
	stone: { bg: 'bg-stone-100', text: 'text-stone-600', dot: 'bg-stone-400', wash: 'bg-stone-500/10' },
};

export function nextTagColor(existingCount: number): TagColor {
	return TAG_COLOR_ORDER[existingCount % TAG_COLOR_ORDER.length];
}

// Calendar: Monday-first grids, all dates as 'YYYY-MM-DD' keys — consistent
// with Task.dueDate/getLocalDateKey elsewhere. `.day()` is always Sunday=0
// regardless of locale, so `(day() + 6) % 7` (matching DatePicker.tsx) is used
// to offset to a Monday-first week instead.
export const HOUR_HEIGHT = 48; // px per hour in the week/day time grid
export const SNAP_MINUTES = 15;

export function getMonthGridDates(cursorDateKey: string): string[] {
	const startOfMonth = dayjs(cursorDateKey).startOf('month');
	const gridStart = startOfMonth.subtract((startOfMonth.day() + 6) % 7, 'day');
	return Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day').format('YYYY-MM-DD'));
}

export function getWeekDates(cursorDateKey: string): string[] {
	const d = dayjs(cursorDateKey);
	const weekStart = d.subtract((d.day() + 6) % 7, 'day');
	return Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day').format('YYYY-MM-DD'));
}

export const RECURRENCE_FREQ_ORDER: RecurrenceFreq[] = ['daily', 'weekly', 'monthly', 'yearly'];

export const RECURRENCE_FREQ_META: Record<RecurrenceFreq, { label: string; unitLabel: string }> = {
	daily: { label: 'Daily', unitLabel: 'days' },
	weekly: { label: 'Weekly', unitLabel: 'weeks' },
	monthly: { label: 'Monthly', unitLabel: 'months' },
	yearly: { label: 'Yearly', unitLabel: 'years' },
};

// Monday-first dayjs `.day()` values (0=Sun..6=Sat), for the weekday-toggle UI.
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const RECURRENCE_MAX_ITERATIONS = 3660; // ~10 years of days — a safety cap, not an expected horizon

// Day-by-day predicate: does `dateKey` land on an occurrence of `rule`,
// anchored at `anchorDateKey`? Doesn't consider `rule.count` — callers that
// care about a occurrence-count cutoff track that themselves while walking
// forward in date order (see computeNextOccurrenceDate/expandEventsForRange).
function matchesRecurrence(dateKey: string, anchorDateKey: string, rule: RecurrenceRule): boolean {
	const date = dayjs(dateKey);
	const anchor = dayjs(anchorDateKey);
	if (date.isBefore(anchor, 'day')) return false;
	if (rule.endDate && dateKey > rule.endDate) return false;

	if (rule.freq === 'daily') {
		return date.diff(anchor, 'day') % rule.interval === 0;
	}
	if (rule.freq === 'weekly') {
		const weekdays = rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday : [anchor.day()];
		if (!weekdays.includes(date.day())) return false;
		const anchorWeekStart = anchor.subtract((anchor.day() + 6) % 7, 'day');
		const dateWeekStart = date.subtract((date.day() + 6) % 7, 'day');
		const weekDiff = dateWeekStart.diff(anchorWeekStart, 'day') / 7;
		return weekDiff % rule.interval === 0;
	}
	if (rule.freq === 'monthly') {
		if (date.date() !== anchor.date()) return false;
		const monthDiff = (date.year() - anchor.year()) * 12 + (date.month() - anchor.month());
		return monthDiff % rule.interval === 0;
	}
	// yearly
	if (date.date() !== anchor.date() || date.month() !== anchor.month()) return false;
	return (date.year() - anchor.year()) % rule.interval === 0;
}

// Counts occurrences of `rule` from `anchorDateKey` through `throughDateKey`
// (inclusive of both ends), used to check a `count`-limited rule for
// exhaustion. Bounded by the same safety cap as the walks below.
function countOccurrencesThrough(throughDateKey: string, anchorDateKey: string, rule: RecurrenceRule): number {
	let cursor = dayjs(anchorDateKey);
	let count = 0;
	for (let i = 0; i < RECURRENCE_MAX_ITERATIONS && cursor.format('YYYY-MM-DD') <= throughDateKey; i++) {
		if (matchesRecurrence(cursor.format('YYYY-MM-DD'), anchorDateKey, rule)) count++;
		cursor = cursor.add(1, 'day');
	}
	return count;
}

// Walks forward day-by-day from `fromDateKey` (exclusive) and returns the
// first date matching `rule`, or null once `rule.endDate`/`count` is exhausted.
export function computeNextOccurrenceDate(fromDateKey: string, anchorDateKey: string, rule: RecurrenceRule): string | null {
	if (rule.count && countOccurrencesThrough(fromDateKey, anchorDateKey, rule) >= rule.count) return null;
	let cursor = dayjs(fromDateKey).add(1, 'day');
	for (let i = 0; i < RECURRENCE_MAX_ITERATIONS; i++) {
		const dateKey = cursor.format('YYYY-MM-DD');
		if (rule.endDate && dateKey > rule.endDate) return null;
		if (matchesRecurrence(dateKey, anchorDateKey, rule)) return dateKey;
		cursor = cursor.add(1, 'day');
	}
	return null;
}

// Expands every recurring CalendarEvent into virtual per-occurrence copies
// within [rangeStart, rangeEnd] (inclusive 'YYYY-MM-DD' keys), so every
// existing `.filter(e => e.date === dateKey)` call site in the calendar views
// keeps working unmodified against the returned list. Non-recurring events
// (including single-occurrence overrides) pass through unchanged.
export function expandEventsForRange(events: CalendarEvent[], rangeStart: string, rangeEnd: string): CalendarEvent[] {
	const result: CalendarEvent[] = [];
	for (const event of events) {
		if (!event.recurrence) {
			result.push(event);
			continue;
		}
		const rule = event.recurrence;
		let cursor = dayjs(event.date);
		let occurrenceCount = 0;
		for (let i = 0; i < RECURRENCE_MAX_ITERATIONS && cursor.format('YYYY-MM-DD') <= rangeEnd; i++) {
			const dateKey = cursor.format('YYYY-MM-DD');
			if (rule.endDate && dateKey > rule.endDate) break;
			if (matchesRecurrence(dateKey, event.date, rule)) {
				occurrenceCount++;
				if (rule.count && occurrenceCount > rule.count) break;
				if (dateKey >= rangeStart && !event.recurrenceExceptions.includes(dateKey)) {
					result.push({ ...event, id: `${event.id}::${dateKey}`, date: dateKey, recurrenceMasterId: event.id });
				}
			}
			cursor = cursor.add(1, 'day');
		}
	}
	return result;
}

export function timeToMinutes(time: string): number {
	const [h, m] = time.split(':').map(Number);
	return h * 60 + m;
}

// All-day events first (regardless of their placeholder startTime), then
// timed events ascending by start — shared by Month and Agenda views so a
// day's events read in the same order everywhere.
export function compareEventsForDisplay(a: CalendarEvent, b: CalendarEvent): number {
	if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
	return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
}

export function minutesToTime(minutes: number): string {
	const clamped = Math.max(0, Math.min(24 * 60 - SNAP_MINUTES, minutes));
	const snapped = Math.round(clamped / SNAP_MINUTES) * SNAP_MINUTES;
	const h = Math.floor(snapped / 60)
		.toString()
		.padStart(2, '0');
	const m = (snapped % 60).toString().padStart(2, '0');
	return `${h}:${m}`;
}
