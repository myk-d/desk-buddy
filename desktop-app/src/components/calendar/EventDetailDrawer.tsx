import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { RecurrencePicker } from '../ui/RecurrencePicker';
import { Switch } from '../ui/Switch';
import { useConfirm } from '../../context/ConfirmContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoResizeTextarea } from '../../hooks/useAutoResizeTextarea';
import { inputClass } from '../../lib/ui';
import { TAG_COLOR_META, TAG_COLOR_ORDER, minutesToTime, timeToMinutes } from '../../lib/utils';
import type { CalendarEvent, RecurrenceRule, TagColor } from '../../types';

type RecurrenceScope = 'this' | 'all';

interface EventDetailDrawerProps {
	event: CalendarEvent | null;
	defaultDate: string;
	defaultStartTime?: string;
	onCreate: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
	onUpdate: (id: string, patch: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>, scope: RecurrenceScope) => void;
	onDelete: (id: string, scope: RecurrenceScope) => void;
	onClose: () => void;
}

const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
	{ value: null, label: 'No reminder' },
	{ value: 5, label: '5 minutes before' },
	{ value: 15, label: '15 minutes before' },
	{ value: 30, label: '30 minutes before' },
	{ value: 60, label: '1 hour before' },
	{ value: 1440, label: '1 day before' },
];

// One drawer handles both create (event=null) and edit to avoid a duplicate form.
export function EventDetailDrawer({
	event,
	defaultDate,
	defaultStartTime,
	onCreate,
	onUpdate,
	onDelete,
	onClose,
}: EventDetailDrawerProps) {
	const initialStart = event?.startTime ?? defaultStartTime ?? '09:00';
	const [title, setTitle] = useState(event?.title ?? '');
	const titleRef = useAutoResizeTextarea(title);
	const [description, setDescription] = useState(event?.description ?? '');
	const descriptionRef = useAutoResizeTextarea(description);
	const [date, setDate] = useState(event?.date ?? defaultDate);
	const [allDay, setAllDay] = useState(event?.allDay ?? false);
	const [startTime, setStartTime] = useState(initialStart);
	const [endTime, setEndTime] = useState(event?.endTime ?? minutesToTime(timeToMinutes(initialStart) + 60));
	const [location, setLocation] = useState(event?.location ?? '');
	const [color, setColor] = useState<TagColor>(event?.color ?? 'sky');
	const [reminderMinutes, setReminderMinutes] = useState<number | null>(event?.reminderMinutes ?? 15);
	const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(event?.recurrence ?? null);
	// Recurring events/occurrences default to editing just this one instance —
	// the safer, less-surprising choice — rather than silently rewriting the
	// whole series.
	const [scope, setScope] = useState<RecurrenceScope>('this');
	const [error, setError] = useState('');
	const confirm = useConfirm();
	useBodyScrollLock(true);

	// True for a series master (opened via a virtual occurrence, which carries
	// the master's `recurrence` along) or a standalone single-occurrence
	// override (`recurrenceMasterId` set) — either way, edits/deletes need a
	// this-occurrence-vs-whole-series scope choice.
	const isSeriesRelated = !!(event?.recurrence || event?.recurrenceMasterId);

	const [initial] = useState({
		title: event?.title ?? '',
		description: event?.description ?? '',
		date: event?.date ?? defaultDate,
		allDay: event?.allDay ?? false,
		startTime: initialStart,
		endTime: event?.endTime ?? minutesToTime(timeToMinutes(initialStart) + 60),
		location: event?.location ?? '',
		color: event?.color ?? 'sky',
		reminderMinutes: event?.reminderMinutes ?? 15,
		recurrence: event?.recurrence ?? null,
	});
	const isDirty =
		title !== initial.title ||
		description !== initial.description ||
		date !== initial.date ||
		allDay !== initial.allDay ||
		startTime !== initial.startTime ||
		endTime !== initial.endTime ||
		location !== initial.location ||
		color !== initial.color ||
		reminderMinutes !== initial.reminderMinutes ||
		JSON.stringify(recurrence) !== JSON.stringify(initial.recurrence);

	const handleSave = async () => {
		const trimmedTitle = title.trim();
		if (!trimmedTitle) {
			setError('Enter an event title');
			return;
		}
		if (!allDay && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
			setError('End time must be after start time');
			return;
		}
		if (!event) {
			onCreate({
				title: trimmedTitle,
				description,
				date,
				allDay,
				startTime,
				endTime,
				location,
				color,
				reminderMinutes,
				recurrence,
				recurrenceExceptions: [],
				recurrenceMasterId: null,
			});
			onClose();
			return;
		}
		const effectiveScope: RecurrenceScope = isSeriesRelated ? scope : 'this';

		// Clearing recurrence for the whole series cancels every future occurrence
		// it would otherwise have generated — a destructive action worth a
		// confirmation, unlike turning recurrence off on a plain event.
		if (effectiveScope === 'all' && event.recurrence && !recurrence) {
			const confirmed = await confirm({
				title: 'Stop repeating?',
				message: 'All future occurrences of this series will be cancelled. This can’t be undone.',
				confirmLabel: 'Stop repeating',
			});
			if (!confirmed) return;
		}

		onUpdate(
			event.id,
			{
				title: trimmedTitle,
				description,
				allDay,
				startTime,
				endTime,
				location,
				color,
				reminderMinutes,
				recurrence,
				// Applying "all events" shouldn't silently shift the series' anchor
				// date to whichever single occurrence happened to be open.
				...(effectiveScope === 'all' ? {} : { date }),
			},
			effectiveScope
		);
		onClose();
	};

	const handleClose = async () => {
		if (
			!isDirty ||
			(await confirm({
				title: 'Close without saving?',
				message: 'You have unsaved changes that will be lost.',
				confirmLabel: 'Close',
				cancelLabel: 'Keep editing',
			}))
		) {
			onClose();
		}
	};

	const handleDelete = async () => {
		if (!event) return;
		const effectiveScope: RecurrenceScope = isSeriesRelated ? scope : 'this';
		const confirmTitle =
			effectiveScope === 'all' ? `Delete all events in the series "${event.title}"?` : `Delete event "${event.title}"?`;
		if (await confirm({ title: confirmTitle, confirmLabel: 'Delete' })) {
			onDelete(event.id, effectiveScope);
			onClose();
		}
	};

	return (
		<>
			<div onClick={handleClose} className="animate-fade-in fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" />
			<aside className="animate-slide-in-right fixed inset-y-0 right-0 z-40 flex h-full w-full flex-col overflow-y-auto border-l border-stone-200 bg-white px-5 py-6 md:w-1/2 md:max-w-2xl">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
					{event ? 'Event' : 'New event'}
				</h2>
				<div className="flex items-center gap-1">
					{event && (
						<button
							onClick={handleDelete}
							className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-500"
							aria-label="Delete event"
						>
							<Trash2 size={16} />
						</button>
					)}
					<button onClick={handleClose} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
						<X size={18} />
					</button>
				</div>
			</div>

			<textarea
				ref={titleRef}
				rows={1}
				autoFocus
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						(e.target as HTMLTextAreaElement).blur();
					}
				}}
				placeholder="Event title"
				className={`${inputClass} mb-4 w-full resize-none overflow-hidden text-base font-semibold`}
			/>

			<div className="flex flex-col gap-4">
				<div>
					<div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">Date</div>
					<div className="flex flex-wrap items-center gap-1.5">
						<DatePicker value={date} onChange={(d) => setDate(d ?? defaultDate)} />
						{(!isSeriesRelated || scope === 'all') && (
							<RecurrencePicker value={recurrence} anchorDate={date} onChange={setRecurrence} />
						)}
					</div>
				</div>

				{isSeriesRelated && (
					<div>
						<div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">Apply to</div>
						<div className="flex gap-1.5">
							<button
								type="button"
								onClick={() => setScope('this')}
								className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium ${
									scope === 'this' ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
								}`}
							>
								This event
							</button>
							<button
								type="button"
								onClick={() => setScope('all')}
								className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium ${
									scope === 'all' ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
								}`}
							>
								All events in series
							</button>
						</div>
					</div>
				)}

				<div className="flex items-center justify-between">
					<span className="text-sm text-stone-600">All day</span>
					<Switch checked={allDay} onChange={setAllDay} />
				</div>

				{!allDay && (
					<div className="flex items-center gap-2">
						<input
							type="time"
							value={startTime}
							onChange={(e) => {
								const nextStart = e.target.value;
								setStartTime(nextStart);
								// Keep end time valid by default when it'd no longer be after
								// the new start — the user can still edit it manually after.
								if (timeToMinutes(nextStart) >= timeToMinutes(endTime)) {
									setEndTime(minutesToTime(timeToMinutes(nextStart) + 60));
								}
							}}
							className={`${inputClass} flex-1`}
						/>
						<span className="text-stone-400">–</span>
						<input
							type="time"
							value={endTime}
							onChange={(e) => setEndTime(e.target.value)}
							className={`${inputClass} flex-1`}
						/>
					</div>
				)}

				<div>
					<div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">Location</div>
					<input
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						placeholder="Add location"
						className={`${inputClass} w-full`}
					/>
				</div>

				<div>
					<div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">Color</div>
					<div className="flex items-center gap-2">
						{TAG_COLOR_ORDER.map((c) => (
							<button
								key={c}
								onClick={() => setColor(c)}
								className={`h-6 w-6 rounded-full ${TAG_COLOR_META[c].dot} ${
									color === c ? 'ring-2 ring-offset-2 ring-stone-400' : ''
								}`}
								aria-label={c}
							/>
						))}
					</div>
				</div>

				<div>
					<div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">Reminder</div>
					<select
						value={reminderMinutes ?? ''}
						onChange={(e) => setReminderMinutes(e.target.value === '' ? null : Number(e.target.value))}
						className={`${inputClass} w-full`}
					>
						{REMINDER_OPTIONS.map((opt) => (
							<option key={opt.value ?? 'none'} value={opt.value ?? ''}>
								{opt.label}
							</option>
						))}
					</select>
				</div>

				<div>
					<div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">Description</div>
					<textarea
						ref={descriptionRef}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Add a description..."
						rows={4}
						className={`${inputClass} w-full resize-none overflow-hidden`}
					/>
				</div>

				{error && <p className="text-xs text-red-500">{error}</p>}

				<button
					onClick={handleSave}
					className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
				>
					{event ? 'Save' : 'Create'}
				</button>
			</div>
			</aside>
		</>
	);
}
