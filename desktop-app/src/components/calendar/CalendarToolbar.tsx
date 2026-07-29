import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

export type CalendarViewType = 'month' | 'week' | 'day' | 'agenda';

interface CalendarToolbarProps {
	view: CalendarViewType;
	onSetView: (view: CalendarViewType) => void;
	title: string;
	onPrev: () => void;
	onNext: () => void;
	onToday: () => void;
	onAddEvent: () => void;
}

const VIEW_OPTIONS: { value: CalendarViewType; label: string }[] = [
	{ value: 'month', label: 'Month' },
	{ value: 'week', label: 'Week' },
	{ value: 'day', label: 'Day' },
	{ value: 'agenda', label: 'Agenda' },
];

export function CalendarToolbar({ view, onSetView, title, onPrev, onNext, onToday, onAddEvent }: CalendarToolbarProps) {
	return (
		<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
			<div className="flex items-center gap-3">
				<h1 className="text-xl font-bold capitalize text-stone-800">{title}</h1>
				<div className="flex items-center gap-1">
					<button onClick={onPrev} className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
						<ChevronLeft size={16} />
					</button>
					<button
						onClick={onToday}
						className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200"
					>
						Today
					</button>
					<button onClick={onNext} className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
						<ChevronRight size={16} />
					</button>
				</div>
			</div>

			<div className="flex items-center gap-2">
				<div className="flex items-center gap-0.5 rounded-full bg-stone-100 p-0.5">
					{VIEW_OPTIONS.map((option) => (
						<button
							key={option.value}
							onClick={() => onSetView(option.value)}
							className={`rounded-full px-3 py-1 text-xs font-medium transition ${option.value === 'week' ? 'hidden md:inline-flex' : ''} ${
								view === option.value ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
							}`}
						>
							{option.label}
						</button>
					))}
				</div>
				<button
					onClick={onAddEvent}
					className="flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
				>
					<Plus size={14} /> Event
				</button>
			</div>
		</div>
	);
}
