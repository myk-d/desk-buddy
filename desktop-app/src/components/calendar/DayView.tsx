import { TimeGrid } from './TimeGrid';
import type { CalendarEvent, Task } from '../../types';

interface DayViewProps {
	dateKey: string;
	events: CalendarEvent[];
	tasks: Task[];
	onSelectEvent: (id: string) => void;
	onSelectTask: (id: string) => void;
	onMoveEvent: (id: string, date: string, startTime: string, endTime: string) => void;
	onResizeEvent: (id: string, patch: { startTime?: string; endTime?: string }) => void;
	onCreateSlot: (date: string, startTime: string) => void;
}

export function DayView({ dateKey, ...gridProps }: DayViewProps) {
	return <TimeGrid days={[dateKey]} fixedWidthColumns={false} {...gridProps} />;
}
