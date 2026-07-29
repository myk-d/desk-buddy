import dayjs from 'dayjs';
import { useRemoteCollection } from './useRemoteCollection';
import { genId } from '../lib/utils';
import type { CalendarEvent } from '../types';

// A calendar view's `id` is either a real event id, or a synthetic
// `${masterId}::${occurrenceDate}` minted by expandEventsForRange for a
// virtual (not-yet-materialized) occurrence — this splits the two apart.
function parseOccurrenceId(occurrenceId: string): { masterId: string; occurrenceDate: string } | null {
	const sepIndex = occurrenceId.indexOf('::');
	return sepIndex === -1 ? null : { masterId: occurrenceId.slice(0, sepIndex), occurrenceDate: occurrenceId.slice(sepIndex + 2) };
}

export function useEventStore() {
	const [events, setEvents] = useRemoteCollection<CalendarEvent>(window.api.events, []);

	const addEvent = (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): string => {
		const id = genId();
		const now = Date.now();
		setEvents((prev) => [...prev, { ...event, id, createdAt: now, updatedAt: now }]);
		return id;
	};

	const updateEvent = (id: string, patch: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>) => {
		setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e)));
	};

	// Deleting a series master also removes any standalone events that
	// override one of its occurrences, so a deleted series doesn't leave
	// orphaned overrides behind.
	const deleteEvent = (id: string) => {
		setEvents((prev) => prev.filter((e) => e.id !== id && e.recurrenceMasterId !== id));
	};

	// Resolves which master (if any) an occurrence id belongs to, whether it's
	// a virtual id from expandEventsForRange or a real standalone override.
	const resolveMasterId = (occurrenceId: string): string | null => {
		const parsed = parseOccurrenceId(occurrenceId);
		if (parsed) return parsed.masterId;
		return events.find((e) => e.id === occurrenceId)?.recurrenceMasterId ?? null;
	};

	// scope 'all' patches the whole series (the master record). scope 'this' on
	// a virtual occurrence creates a standalone override for just that date
	// (recorded as an exception on the master so it isn't also generated
	// virtually); scope 'this' on a real event (non-recurring, or an existing
	// override) just patches that record directly.
	const updateEventOccurrence = (
		occurrenceId: string,
		patch: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>,
		scope: 'this' | 'all'
	) => {
		const parsed = parseOccurrenceId(occurrenceId);
		const masterId = resolveMasterId(occurrenceId);

		if (scope === 'all' && masterId) {
			const master = events.find((e) => e.id === masterId);
			const splitDate = parsed ? parsed.occurrenceDate : events.find((e) => e.id === occurrenceId)?.date;

			// Changing the repeat pattern (including turning it off) only affects
			// this occurrence and everything after it — past occurrences already
			// happened under the old pattern and shouldn't retroactively change.
			// Splits the series: the old master is truncated to end the day
			// before, and a new record (a fresh series if the new rule isn't null,
			// otherwise a plain standalone event) picks up from here with the
			// edited fields.
			if (master?.recurrence && splitDate && 'recurrence' in patch && JSON.stringify(patch.recurrence) !== JSON.stringify(master.recurrence)) {
				const oldRecurrence = master.recurrence;
				const dayBefore = dayjs(splitDate).subtract(1, 'day').format('YYYY-MM-DD');
				setEvents((prev) =>
					prev.map((e) =>
						e.id === masterId ? { ...e, recurrence: { ...oldRecurrence, endDate: dayBefore }, updatedAt: Date.now() } : e
					)
				);
				const now = Date.now();
				setEvents((prev) => [
					...prev,
					{
						...master,
						...patch,
						id: genId(),
						date: splitDate,
						recurrenceExceptions: [],
						recurrenceMasterId: null,
						createdAt: now,
						updatedAt: now,
					},
				]);
				return;
			}

			updateEvent(masterId, patch);
			return;
		}
		if (!parsed) {
			updateEvent(occurrenceId, patch);
			return;
		}
		const master = events.find((e) => e.id === parsed.masterId);
		if (!master) return;
		setEvents((prev) =>
			prev.map((e) =>
				e.id === parsed.masterId
					? { ...e, recurrenceExceptions: [...e.recurrenceExceptions, parsed.occurrenceDate], updatedAt: Date.now() }
					: e
			)
		);
		const now = Date.now();
		setEvents((prev) => [
			...prev,
			{
				...master,
				...patch,
				id: genId(),
				date: patch.date ?? parsed.occurrenceDate,
				recurrence: null,
				recurrenceExceptions: [],
				recurrenceMasterId: parsed.masterId,
				createdAt: now,
				updatedAt: now,
			},
		]);
	};

	const deleteEventOccurrence = (occurrenceId: string, scope: 'this' | 'all') => {
		const parsed = parseOccurrenceId(occurrenceId);
		const masterId = resolveMasterId(occurrenceId);

		if (scope === 'all' && masterId) {
			deleteEvent(masterId);
			return;
		}
		if (!parsed) {
			deleteEvent(occurrenceId);
			return;
		}
		setEvents((prev) =>
			prev.map((e) =>
				e.id === parsed.masterId
					? { ...e, recurrenceExceptions: [...e.recurrenceExceptions, parsed.occurrenceDate], updatedAt: Date.now() }
					: e
			)
		);
	};

	return { events, addEvent, updateEvent, deleteEvent, updateEventOccurrence, deleteEventOccurrence };
}

export type EventStore = ReturnType<typeof useEventStore>;
