import { useRef, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { formatDueDate } from '../../lib/utils';
import { popoverClass } from '../../lib/ui';

interface DatePickerProps {
	value: string | null;
	onChange: (value: string | null) => void;
}

function buildCalendarGrid(viewMonth: Dayjs): Dayjs[] {
	const startOfMonth = viewMonth.startOf('month');
	const leadingDays = (startOfMonth.day() + 6) % 7; // Monday-first offset
	const daysInMonth = viewMonth.daysInMonth();

	const cells: Dayjs[] = [];
	for (let i = leadingDays; i > 0; i--) cells.push(startOfMonth.subtract(i, 'day'));
	for (let d = 0; d < daysInMonth; d++) cells.push(startOfMonth.add(d, 'day'));
	while (cells.length % 7 !== 0) cells.push(cells[cells.length - 1].add(1, 'day'));
	return cells;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
	const [open, setOpen] = useState(false);
	const [viewMonth, setViewMonth] = useState(() => (value ? dayjs(value) : dayjs()).startOf('month'));
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, () => setOpen(false));

	const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

	const today = dayjs().format('YYYY-MM-DD');
	const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
	const cells = buildCalendarGrid(viewMonth);

	const pick = (d: Dayjs) => {
		onChange(d.format('YYYY-MM-DD'));
		setOpen(false);
	};

	return (
		<div ref={ref} className="relative inline-block">
			<button
				type="button"
				onClick={() => {
					setViewMonth((value ? dayjs(value) : dayjs()).startOf('month'));
					setOpen((v) => !v);
				}}
				className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
					value ? 'bg-stone-100 text-stone-600 hover:bg-stone-200' : 'bg-stone-50 text-stone-400 hover:bg-stone-100'
				}`}
			>
				<CalendarDays size={13} />
				{value ? formatDueDate(value) : 'Date'}
				{value && (
					<span
						role="button"
						tabIndex={-1}
						onClick={(e) => {
							e.stopPropagation();
							onChange(null);
						}}
						className="rounded-full p-0.5 hover:bg-stone-300/50"
					>
						<X size={11} />
					</span>
				)}
			</button>

			{open && (
				<div className={`${popoverClass} absolute left-0 top-9 z-30 w-64 p-3`}>
					<div className="mb-2 flex gap-1.5">
						<button
							type="button"
							onClick={() => pick(dayjs(today))}
							className="rounded-full bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
						>
							Today
						</button>
						<button
							type="button"
							onClick={() => pick(dayjs(tomorrow))}
							className="rounded-full bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
						>
							Tomorrow
						</button>
					</div>

					<div className="mb-2 flex items-center justify-between">
						<button
							type="button"
							onClick={() => setViewMonth((m) => m.subtract(1, 'month'))}
							className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
						>
							<ChevronLeft size={16} />
						</button>
						<span className="text-sm font-semibold capitalize text-stone-700">{viewMonth.format('MMMM YYYY')}</span>
						<button
							type="button"
							onClick={() => setViewMonth((m) => m.add(1, 'month'))}
							className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
						>
							<ChevronRight size={16} />
						</button>
					</div>

					<div className="grid grid-cols-7 gap-y-1 text-center">
						{weekdays.map((w) => (
							<span key={w} className="text-[11px] font-medium text-stone-400">
								{w}
							</span>
						))}
						{cells.map((d) => {
							const key = d.format('YYYY-MM-DD');
							const isCurrentMonth = d.month() === viewMonth.month();
							const isToday = key === today;
							const isSelected = key === value;
							return (
								<button
									key={key}
									type="button"
									onClick={() => pick(d)}
									className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition ${
										isSelected
											? 'bg-brand-600 text-white'
											: isToday
												? 'border border-brand-400 text-brand-700'
												: isCurrentMonth
													? 'text-stone-700 hover:bg-stone-100'
													: 'text-stone-300 hover:bg-stone-50'
									}`}
								>
									{d.date()}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
