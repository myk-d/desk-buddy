import { TimeGrid } from './TimeGrid';
import type { CalendarEvent, Task } from '../../types';

interface WeekViewProps {
	weekDates: string[];
	events: CalendarEvent[];
	tasks: Task[];
	onSelectEvent: (id: string) => void;
	onSelectTask: (id: string) => void;
	onMoveEvent: (id: string, date: string, startTime: string, endTime: string) => void;
	onResizeEvent: (id: string, patch: { startTime?: string; endTime?: string }) => void;
	onCreateSlot: (date: string, startTime: string) => void;
}

export function WeekView({ weekDates, ...gridProps }: WeekViewProps) {
	return <TimeGrid days={weekDates} fixedWidthColumns {...gridProps} />;
}
