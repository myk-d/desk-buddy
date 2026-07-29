import { useRef, useState } from 'react';
import {
	DndContext,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import dayjs from 'dayjs';
import { useClickOutside } from '../../hooks/useClickOutside';
import { TAG_COLOR_META, compareEventsForDisplay } from '../../lib/utils';
import { popoverClass } from '../../lib/ui';
import { EventChip } from './EventChip';
import type { CalendarEvent, Task } from '../../types';

interface MonthItem {
	key: string;
	label: string;
	time?: string;
	color?: CalendarEvent['color'];
	allDay?: boolean;
	onClick: () => void;
	draggableId?: string;
}

interface MonthViewProps {
	monthDates: string[];
	cursorDateKey: string;
	events: CalendarEvent[];
	tasks: Task[];
	onSelectEvent: (id: string) => void;
	onSelectTask: (id: string) => void;
	onMoveEvent: (id: string, date: string) => void;
}

const MAX_VISIBLE = 3;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DraggableChip({ item }: { item: MonthItem }) {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
		id: item.draggableId ?? item.key,
		disabled: !item.draggableId,
	});
	const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };
	return (
		<div ref={setNodeRef} style={style} {...attributes} {...listeners}>
			<EventChip label={item.label} time={item.time} color={item.color} allDay={item.allDay} onClick={item.onClick} />
		</div>
	);
}

function DayCell({
	dateKey,
	isCurrentMonth,
	isToday,
	items,
	overflowOpen,
	onToggleOverflow,
	onCloseOverflow,
}: {
	dateKey: string;
	isCurrentMonth: boolean;
	isToday: boolean;
	items: MonthItem[];
	overflowOpen: boolean;
	onToggleOverflow: () => void;
	onCloseOverflow: () => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: `day:${dateKey}` });
	const overflowRef = useRef<HTMLDivElement>(null);
	useClickOutside(overflowRef, onCloseOverflow);

	const visible = items.slice(0, MAX_VISIBLE);
	const hidden = items.slice(MAX_VISIBLE);
	const allDayItem = items.find((i) => i.allDay && i.color);

	return (
		<div
			ref={setNodeRef}
			className={`relative flex min-h-17.5 flex-col gap-1 border-b border-r border-stone-100 p-1 md:min-h-27.5 md:p-1.5 ${
				isOver
					? 'bg-brand-50'
					: allDayItem?.color
						? TAG_COLOR_META[allDayItem.color].wash
						: isCurrentMonth
							? 'bg-white'
							: 'bg-stone-50/50'
			}`}
		>
			<span
				className={`text-xs font-medium ${
					isToday
						? 'flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white'
						: isCurrentMonth
							? 'text-stone-600'
							: 'text-stone-300'
				}`}
			>
				{dayjs(dateKey).date()}
			</span>

			<div className="flex flex-col gap-0.5">
				{visible.map((item) => (
					<DraggableChip key={item.key} item={item} />
				))}
			</div>

			{hidden.length > 0 && (
				<button
					onClick={onToggleOverflow}
					className="mt-0.5 text-left text-[11px] font-medium text-stone-400 hover:text-stone-600"
				>
					{hidden.length} more
				</button>
			)}

			{overflowOpen && (
				<div ref={overflowRef} className={`${popoverClass} absolute left-1 top-full z-30 mt-1 w-52 p-1.5`}>
					<div className="flex flex-col gap-1">
						{items.map((item) => (
							<EventChip
								key={item.key}
								label={item.label}
								time={item.time}
								color={item.color}
								allDay={item.allDay}
								onClick={item.onClick}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export function MonthView({ monthDates, cursorDateKey, events, tasks, onSelectEvent, onSelectTask, onMoveEvent }: MonthViewProps) {
	const [overflowDate, setOverflowDate] = useState<string | null>(null);
	const cursorMonth = dayjs(cursorDateKey).month();
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		setOverflowDate(null);
		if (!over) return;
		const activeId = String(active.id);
		const overId = String(over.id);
		if (!activeId.startsWith('event:') || !overId.startsWith('day:')) return;
		onMoveEvent(activeId.slice('event:'.length), overId.slice('day:'.length));
	};

	const itemsForDate = (dateKey: string): MonthItem[] => {
		const dayEvents: MonthItem[] = events
			.filter((e) => e.date === dateKey)
			.sort(compareEventsForDisplay)
			.map((e) => ({
				key: `event-${e.id}`,
				label: e.title,
				time: e.allDay ? undefined : e.startTime,
				color: e.color,
				allDay: e.allDay,
				onClick: () => onSelectEvent(e.id),
				draggableId: `event:${e.id}`,
			}));
		const dayTasks: MonthItem[] = tasks
			.filter((t) => t.dueDate === dateKey)
			.map((t) => ({
				key: `task-${t.id}`,
				label: t.text,
				onClick: () => onSelectTask(t.id),
			}));
		return [...dayEvents, ...dayTasks];
	};

	return (
		<div className="flex flex-1 flex-col overflow-hidden rounded-xl border-l border-t border-stone-100">
			<div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50/50">
				{WEEKDAYS.map((day) => (
					<div key={day} className="px-2 py-1.5 text-center text-xs font-semibold text-stone-400">
						{day}
					</div>
				))}
			</div>
			<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
				<div className="grid flex-1 grid-cols-7 overflow-y-auto">
					{monthDates.map((dateKey) => (
						<DayCell
							key={dateKey}
							dateKey={dateKey}
							isCurrentMonth={dayjs(dateKey).month() === cursorMonth}
							isToday={dateKey === dayjs().format('YYYY-MM-DD')}
							items={itemsForDate(dateKey)}
							overflowOpen={overflowDate === dateKey}
							onToggleOverflow={() => setOverflowDate((v) => (v === dateKey ? null : dateKey))}
							onCloseOverflow={() => setOverflowDate((v) => (v === dateKey ? null : v))}
						/>
					))}
				</div>
			</DndContext>
		</div>
	);
}
