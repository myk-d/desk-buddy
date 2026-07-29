import dayjs from 'dayjs';
import { TAG_COLOR_META, compareEventsForDisplay } from '../../lib/utils';
import type { CalendarEvent, Task } from '../../types';

interface AgendaViewProps {
	days: string[];
	events: CalendarEvent[];
	tasks: Task[];
	onSelectEvent: (id: string) => void;
	onSelectTask: (id: string) => void;
}

export function AgendaView({ days, events, tasks, onSelectEvent, onSelectTask }: AgendaViewProps) {
	const todayKey = dayjs().format('YYYY-MM-DD');
	const nonEmptyDays = days.filter((d) => events.some((e) => e.date === d) || tasks.some((t) => t.dueDate === d));

	if (nonEmptyDays.length === 0) {
		return <p className="mt-4 text-sm text-stone-400">No events in this period.</p>;
	}

	return (
		<div className="flex flex-1 flex-col gap-4 overflow-y-auto">
			{nonEmptyDays.map((dateKey) => {
				const dayEvents = [...events.filter((e) => e.date === dateKey)].sort(compareEventsForDisplay);
				const dayTasks = tasks.filter((t) => t.dueDate === dateKey);
				return (
					<div key={dateKey}>
						<div className="mb-1.5 flex items-center gap-2">
							<span
								className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
									dateKey === todayKey ? 'bg-brand-600 text-white' : 'text-stone-700'
								}`}
							>
								{dayjs(dateKey).date()}
							</span>
							<span className="text-sm font-medium capitalize text-stone-600">
								{dayjs(dateKey).format('dddd, D MMMM')}
							</span>
						</div>
						<div className="flex flex-col gap-1 pl-1">
							{dayEvents.map((event) => (
								<button
									key={event.id}
									onClick={() => onSelectEvent(event.id)}
									className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
										event.allDay ? TAG_COLOR_META[event.color].wash : TAG_COLOR_META[event.color].bg
									} ${TAG_COLOR_META[event.color].text}`}
								>
									<span className="w-12 shrink-0 text-xs opacity-70">{event.allDay ? 'All day' : event.startTime}</span>
									<span className="truncate font-medium">{event.title}</span>
								</button>
							))}
							{dayTasks.map((task) => (
								<button
									key={task.id}
									onClick={() => onSelectTask(task.id)}
									className="flex items-center gap-2 rounded-lg bg-stone-100 px-2 py-1.5 text-left text-sm text-stone-600"
								>
									<span className="w-12 shrink-0 text-xs opacity-70">Task</span>
									<span className="truncate">{task.text}</span>
								</button>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}
