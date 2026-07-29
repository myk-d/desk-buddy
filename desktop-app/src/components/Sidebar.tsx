import { LayoutDashboard, ListTodo, CalendarDays, Timer, Cpu, Target } from 'lucide-react';
import type { Page } from '../types';

const NAV_ITEMS: [Page, string, typeof LayoutDashboard][] = [
	['dashboard', 'Dashboard', LayoutDashboard],
	['tasks', 'Tasks', ListTodo],
	['calendar', 'Calendar', CalendarDays],
	['pomodoro', 'Pomodoro', Timer],
	['device', 'Device', Cpu],
];

const navButtonClass = (active: boolean) =>
	`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition md:w-full ${
		active ? 'bg-brand-100 text-brand-700' : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'
	}`;

interface Props {
	activePage: Page;
	onPageChange: (page: Page) => void;
	connected: boolean;
	connectedPath: string;
}

export function Sidebar({ activePage, onPageChange, connected, connectedPath }: Props) {
	return (
		<>
			{/* Desktop: vertical icon rail */}
			<nav className="hidden h-full w-16 shrink-0 flex-col items-center gap-2 border-r border-stone-200 bg-white py-4 md:flex">
				<div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
					<Target size={18} />
				</div>
				{NAV_ITEMS.map(([id, label, Icon]) => (
					<button key={id} onClick={() => onPageChange(id)} className={navButtonClass(activePage === id)}>
						<Icon size={19} />
						{label}
					</button>
				))}
				<div
					title={connected ? `Device connected: ${connectedPath}` : 'Connecting to device…'}
					className="mt-auto flex h-9 w-9 items-center justify-center rounded-full"
				>
					<span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-stone-300'}`} />
				</div>
			</nav>

			{/* Mobile: bottom tab bar */}
			<nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-stone-200 bg-white py-1 md:hidden">
				{NAV_ITEMS.map(([id, label, Icon]) => (
					<button key={id} onClick={() => onPageChange(id)} className={navButtonClass(activePage === id)}>
						<Icon size={19} />
						{label}
					</button>
				))}
			</nav>
		</>
	);
}
