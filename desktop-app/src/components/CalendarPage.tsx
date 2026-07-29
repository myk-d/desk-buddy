import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useTaskStoreContext } from '../context/TaskStoreContext';
import { useEventStoreContext } from '../context/EventStoreContext';
import { TaskDetailPanel } from './TaskDetailPanel';
import { CalendarToolbar, type CalendarViewType } from './calendar/CalendarToolbar';
import { MonthView } from './calendar/MonthView';
import { WeekView } from './calendar/WeekView';
import { DayView } from './calendar/DayView';
import { AgendaView } from './calendar/AgendaView';
import { EventDetailDrawer } from './calendar/EventDetailDrawer';
import { expandEventsForRange, getMonthGridDates, getWeekDates } from '../lib/utils';

type DrawerState = { mode: 'create'; date: string; startTime?: string } | { mode: 'edit'; eventId: string } | null;

const AGENDA_WINDOW_DAYS = 14;

export function CalendarPage() {
	const { tasks, lists } = useTaskStoreContext();
	const { events, addEvent, updateEventOccurrence, deleteEventOccurrence } = useEventStoreContext();
	const [view, setView] = useState<CalendarViewType>('month');
	const [cursorDateKey, setCursorDateKey] = useState(() => dayjs().format('YYYY-MM-DD'));
	const [drawer, setDrawer] = useState<DrawerState>(null);
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

	const monthDates = getMonthGridDates(cursorDateKey);
	const weekDates = getWeekDates(cursorDateKey);
	const agendaDates = Array.from({ length: AGENDA_WINDOW_DAYS }, (_, i) =>
		dayjs(cursorDateKey).add(i, 'day').format('YYYY-MM-DD')
	);

	// Expand recurring events into virtual per-occurrence copies over the
	// widest range any of the four views could currently need, so every view's
	// existing `.filter(e => e.date === dateKey)` logic keeps working unmodified.
	const rangeEvents = useMemo(() => {
		const allVisibleDates = [...monthDates, ...weekDates, ...agendaDates];
		const rangeStart = allVisibleDates.reduce((a, b) => (a < b ? a : b));
		const rangeEnd = allVisibleDates.reduce((a, b) => (a > b ? a : b));
		return expandEventsForRange(events, rangeStart, rangeEnd);
	}, [events, monthDates, weekDates, agendaDates]);

	// Derived, not stored: an edit-mode drawer auto-closes if the event is
	// deleted elsewhere, and a due-date task's panel closes the same way.
	const selectedTask = selectedTaskId ? (tasks.find((t) => t.id === selectedTaskId) ?? null) : null;
	const selectedEvent = drawer?.mode === 'edit' ? (rangeEvents.find((e) => e.id === drawer.eventId) ?? null) : null;
	const drawerVisible = drawer?.mode === 'create' || (drawer?.mode === 'edit' && selectedEvent !== null);

	const title = (() => {
		if (view === 'month') return dayjs(cursorDateKey).format('MMMM YYYY');
		if (view === 'week') return `${dayjs(weekDates[0]).format('D MMM')} – ${dayjs(weekDates[6]).format('D MMM YYYY')}`;
		if (view === 'day') return dayjs(cursorDateKey).format('D MMMM YYYY, dddd');
		return `${dayjs(agendaDates[0]).format('D MMM')} – ${dayjs(agendaDates[agendaDates.length - 1]).format('D MMM YYYY')}`;
	})();

	const shiftCursor = (direction: 1 | -1) => {
		if (view === 'month') return setCursorDateKey(dayjs(cursorDateKey).add(direction, 'month').format('YYYY-MM-DD'));
		if (view === 'week') return setCursorDateKey(dayjs(cursorDateKey).add(direction * 7, 'day').format('YYYY-MM-DD'));
		if (view === 'day') return setCursorDateKey(dayjs(cursorDateKey).add(direction, 'day').format('YYYY-MM-DD'));
		return setCursorDateKey(dayjs(cursorDateKey).add(direction * AGENDA_WINDOW_DAYS, 'day').format('YYYY-MM-DD'));
	};

	const openEdit = (eventId: string) => setDrawer({ mode: 'edit', eventId });

	return (
		<div className="flex h-full">
			<section className="flex h-full min-w-0 flex-1 flex-col overflow-hidden px-6 py-6">
				<CalendarToolbar
					view={view}
					onSetView={setView}
					title={title}
					onPrev={() => shiftCursor(-1)}
					onNext={() => shiftCursor(1)}
					onToday={() => setCursorDateKey(dayjs().format('YYYY-MM-DD'))}
					onAddEvent={() => setDrawer({ mode: 'create', date: cursorDateKey })}
				/>

				{view === 'month' && (
					<MonthView
						monthDates={monthDates}
						cursorDateKey={cursorDateKey}
						events={rangeEvents}
						tasks={tasks}
						onSelectEvent={openEdit}
						onSelectTask={setSelectedTaskId}
						onMoveEvent={(id, date) => updateEventOccurrence(id, { date }, 'this')}
					/>
				)}

				{view === 'week' && (
					<WeekView
						weekDates={weekDates}
						events={rangeEvents}
						tasks={tasks}
						onSelectEvent={openEdit}
						onSelectTask={setSelectedTaskId}
						onMoveEvent={(id, date, startTime, endTime) => updateEventOccurrence(id, { date, startTime, endTime }, 'this')}
						onResizeEvent={(id, patch) => updateEventOccurrence(id, patch, 'this')}
						onCreateSlot={(date, startTime) => setDrawer({ mode: 'create', date, startTime })}
					/>
				)}

				{view === 'day' && (
					<DayView
						dateKey={cursorDateKey}
						events={rangeEvents}
						tasks={tasks}
						onSelectEvent={openEdit}
						onSelectTask={setSelectedTaskId}
						onMoveEvent={(id, date, startTime, endTime) => updateEventOccurrence(id, { date, startTime, endTime }, 'this')}
						onResizeEvent={(id, patch) => updateEventOccurrence(id, patch, 'this')}
						onCreateSlot={(date, startTime) => setDrawer({ mode: 'create', date, startTime })}
					/>
				)}

				{view === 'agenda' && (
					<AgendaView days={agendaDates} events={rangeEvents} tasks={tasks} onSelectEvent={openEdit} onSelectTask={setSelectedTaskId} />
				)}
			</section>

			{drawerVisible && (
				<EventDetailDrawer
					event={selectedEvent}
					defaultDate={drawer?.mode === 'create' ? drawer.date : cursorDateKey}
					defaultStartTime={drawer?.mode === 'create' ? drawer.startTime : undefined}
					onCreate={(event) => addEvent(event)}
					onUpdate={(id, patch, scope) => updateEventOccurrence(id, patch, scope)}
					onDelete={(id, scope) => deleteEventOccurrence(id, scope)}
					onClose={() => setDrawer(null)}
				/>
			)}

			{selectedTask && <TaskDetailPanel task={selectedTask} lists={lists} onClose={() => setSelectedTaskId(null)} />}
		</div>
	);
}
