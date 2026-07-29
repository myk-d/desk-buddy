import type { MouseEvent as ReactMouseEvent } from 'react';
import { DndContext, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import dayjs from 'dayjs';
import { HOUR_HEIGHT, TAG_COLOR_META, minutesToTime, timeToMinutes } from '../../lib/utils';
import { EventChip } from './EventChip';
import { EventBlock } from './EventBlock';
import type { CalendarEvent, Task } from '../../types';

interface TimeGridProps {
	days: string[];
	events: CalendarEvent[];
	tasks: Task[];
	onSelectEvent: (id: string) => void;
	onSelectTask: (id: string) => void;
	onMoveEvent: (id: string, date: string, startTime: string, endTime: string) => void;
	onResizeEvent: (id: string, patch: { startTime?: string; endTime?: string }) => void;
	onCreateSlot: (date: string, startTime: string) => void;
	// Week view forces a fixed per-day width on mobile (so it scrolls horizontally
	// instead of squishing 7 columns unreadably); Day view has only one column and
	// should always fill the available width instead.
	fixedWidthColumns: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function computeOverlapIndices(dayEvents: CalendarEvent[]): Map<string, number> {
	const sorted = [...dayEvents].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
	const active: { end: number; index: number }[] = [];
	const indices = new Map<string, number>();
	for (const event of sorted) {
		const start = timeToMinutes(event.startTime);
		for (let i = active.length - 1; i >= 0; i--) {
			if (active[i].end <= start) active.splice(i, 1);
		}
		const used = new Set(active.map((a) => a.index));
		let index = 0;
		while (used.has(index)) index++;
		indices.set(event.id, index);
		active.push({ end: timeToMinutes(event.endTime), index });
	}
	return indices;
}

function DayColumn({
	dateKey,
	events,
	onSelectEvent,
	onResizeEvent,
	onCreateSlot,
	fixedWidth,
}: {
	dateKey: string;
	events: CalendarEvent[];
	onSelectEvent: (id: string) => void;
	onResizeEvent: (id: string, patch: { startTime?: string; endTime?: string }) => void;
	onCreateSlot: (date: string, startTime: string) => void;
	fixedWidth: boolean;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: `col:${dateKey}` });
	const timedEvents = events.filter((e) => e.date === dateKey && !e.allDay);
	const overlapIndices = computeOverlapIndices(timedEvents);
	const allDayEvent = events.find((e) => e.date === dateKey && e.allDay);

	const handleGridClick = (e: ReactMouseEvent<HTMLDivElement>) => {
		if (e.target !== e.currentTarget) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const minutes = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
		onCreateSlot(dateKey, minutesToTime(minutes));
	};

	return (
		<div
			ref={setNodeRef}
			onClick={handleGridClick}
			className={`relative border-r border-stone-200 ${fixedWidth ? 'w-27.5 shrink-0 md:w-auto md:flex-1 md:shrink' : 'flex-1'} ${
				isOver ? 'bg-brand-50' : allDayEvent ? TAG_COLOR_META[allDayEvent.color].wash : ''
			}`}
			style={{ height: 24 * HOUR_HEIGHT }}
		>
			{HOURS.map((h) => (
				<div key={h} className="pointer-events-none border-b border-stone-200" style={{ height: HOUR_HEIGHT }} />
			))}
			{timedEvents.map((event) => (
				<EventBlock
					key={event.id}
					event={event}
					overlapIndex={overlapIndices.get(event.id) ?? 0}
					onSelect={() => onSelectEvent(event.id)}
					onResize={(patch) => onResizeEvent(event.id, patch)}
				/>
			))}
		</div>
	);
}

export function TimeGrid({
	days,
	events,
	tasks,
	onSelectEvent,
	onSelectTask,
	onMoveEvent,
	onResizeEvent,
	onCreateSlot,
	fixedWidthColumns,
}: TimeGridProps) {
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
	const todayKey = dayjs().format('YYYY-MM-DD');

	const handleDragEnd = ({ active, over, delta }: DragEndEvent) => {
		if (!over) return;
		const activeId = String(active.id);
		const overId = String(over.id);
		if (!activeId.startsWith('event:') || !overId.startsWith('col:')) return;
		const eventId = activeId.slice('event:'.length);
		const targetDate = overId.slice('col:'.length);
		const event = events.find((e) => e.id === eventId);
		if (!event) return;

		const duration = timeToMinutes(event.endTime) - timeToMinutes(event.startTime);
		const deltaMinutes = (delta.y / HOUR_HEIGHT) * 60;
		const snappedStart = timeToMinutes(minutesToTime(timeToMinutes(event.startTime) + deltaMinutes));
		const snappedEnd = timeToMinutes(minutesToTime(snappedStart + duration));
		onMoveEvent(eventId, targetDate, minutesToTime(snappedStart), minutesToTime(snappedEnd));
	};

	return (
		<div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-stone-100">
			{/* Single horizontal-scroll container spanning header+body keeps the day
			    columns aligned while swiping sideways on narrow (multi-day) screens. */}
			<div className="flex flex-1 flex-col overflow-x-auto">
				<div className="flex border-b border-stone-100">
					<div className="w-14 shrink-0" />
					{days.map((dateKey) => {
						const allDayItems = [
							...events.filter((e) => e.date === dateKey && e.allDay),
							...tasks.filter((t) => t.dueDate === dateKey),
						];
						return (
							<div
								key={dateKey}
								className={`border-l border-stone-200 px-1.5 py-1.5 ${fixedWidthColumns ? 'w-27.5 shrink-0 md:w-auto md:flex-1 md:shrink' : 'flex-1'}`}
							>
								<div className="mb-1 text-center text-xs font-medium text-stone-500">
									{dayjs(dateKey).format('dd').toUpperCase()}{' '}
									<span
										className={`ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
											dateKey === todayKey ? 'bg-brand-600 text-white' : 'text-stone-700'
										}`}
									>
										{dayjs(dateKey).date()}
									</span>
								</div>
								<div className="flex flex-col gap-0.5">
									{allDayItems.map((item) =>
										'title' in item ? (
											<EventChip
												key={item.id}
												label={item.title}
												color={item.color}
												allDay
												onClick={() => onSelectEvent(item.id)}
											/>
										) : (
											<EventChip key={item.id} label={item.text} onClick={() => onSelectTask(item.id)} />
										)
									)}
								</div>
							</div>
						);
					})}
				</div>

				<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
					<div className="flex flex-1 overflow-y-auto">
						<div className="w-14 shrink-0">
							{HOURS.map((h) => (
								<div
									key={h}
									className="border-b border-stone-200 pr-1.5 text-right text-[11px] text-stone-400"
									style={{ height: HOUR_HEIGHT }}
								>
									{h.toString().padStart(2, '0')}:00
								</div>
							))}
						</div>
						{days.map((dateKey) => (
							<DayColumn
								key={dateKey}
								dateKey={dateKey}
								events={events}
								onSelectEvent={onSelectEvent}
								onResizeEvent={onResizeEvent}
								onCreateSlot={onCreateSlot}
								fixedWidth={fixedWidthColumns}
							/>
						))}
					</div>
				</DndContext>
			</div>
		</div>
	);
}
