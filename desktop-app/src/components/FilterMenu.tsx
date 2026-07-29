import { useRef, useState } from 'react';
import { Check, ListFilter } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';
import { menuItemClass, popoverClass } from '../lib/ui';
import { GROUP_BY_META, GROUP_BY_ORDER, SORT_BY_META, SORT_BY_ORDER } from '../lib/utils';
import type { GroupBy, SortBy } from '../types';

interface FilterMenuProps {
	groupBy: GroupBy;
	sortBy: SortBy;
	onSetGroupBy: (groupBy: GroupBy) => void;
	onSetSortBy: (sortBy: SortBy) => void;
}

export function FilterMenu({ groupBy, sortBy, onSetGroupBy, onSetSortBy }: FilterMenuProps) {
	const [open, setOpen] = useState(false);
	const [subOpen, setSubOpen] = useState<'group' | 'sort' | null>(null);
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, () => {
		setOpen(false);
		setSubOpen(null);
	});

	return (
		<div ref={ref} className="relative">
			<button
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 hover:bg-stone-200"
			>
				<ListFilter size={13} /> Filters
			</button>

			{open && (
				<div className={`${popoverClass} absolute left-0 top-8 z-20 w-56 p-1 text-sm sm:left-auto sm:right-0`}>
					<div className="relative">
						<button
							onClick={() => setSubOpen((v) => (v === 'group' ? null : 'group'))}
							className={`${menuItemClass} justify-between`}
						>
							<span>Group by</span>
							<span className="flex items-center gap-1 text-stone-400">
								{GROUP_BY_META[groupBy].label} <span>›</span>
							</span>
						</button>
						{subOpen === 'group' && (
							<div className={`${popoverClass} absolute left-0 top-full mt-1 w-48 p-1`}>
								{GROUP_BY_ORDER.map((option) => (
									<button
										key={option}
										onClick={() => {
											onSetGroupBy(option);
											setSubOpen(null);
											setOpen(false);
										}}
										className={`${menuItemClass} justify-between`}
									>
										{GROUP_BY_META[option].label}
										{groupBy === option && <Check size={14} className="text-brand-600" />}
									</button>
								))}
							</div>
						)}
					</div>

					<div className="relative">
						<button
							onClick={() => setSubOpen((v) => (v === 'sort' ? null : 'sort'))}
							className={`${menuItemClass} justify-between`}
						>
							<span>Sort by</span>
							<span className="flex items-center gap-1 text-stone-400">
								{SORT_BY_META[sortBy].label} <span>›</span>
							</span>
						</button>
						{subOpen === 'sort' && (
							<div className={`${popoverClass} absolute left-0 top-full mt-1 w-48 p-1`}>
								{SORT_BY_ORDER.map((option) => (
									<button
										key={option}
										onClick={() => {
											onSetSortBy(option);
											setSubOpen(null);
											setOpen(false);
										}}
										className={`${menuItemClass} justify-between`}
									>
										{SORT_BY_META[option].label}
										{sortBy === option && <Check size={14} className="text-brand-600" />}
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
