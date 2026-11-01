import { useMemo, useState } from 'react';
import { TABY_CATEGORIES } from '../constants';

interface Props {
	connected: boolean;
	onCommand: (packet: string, mode: string) => void;
}

// All 84 Taby bonus animations, grouped + searchable — a plain grid of 84
// buttons with no way to narrow it down would be unusable, so this filters
// by id/label substring as you type and collapses empty categories.
export function TabyPicker({ connected, onCommand }: Props) {
	const [query, setQuery] = useState('');

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return TABY_CATEGORIES;
		return TABY_CATEGORIES
			.map((cat) => ({
				...cat,
				items: cat.items.filter((item) => item.id.includes(q) || item.label.toLowerCase().includes(q)),
			}))
			.filter((cat) => cat.items.length > 0);
	}, [query]);

	const totalShown = filtered.reduce((sum, cat) => sum + cat.items.length, 0);

	return (
		<div className="flex w-full max-w-130 min-w-0 flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6">
			<div className="flex items-center justify-between gap-3">
				<span className="text-lg font-bold text-stone-900">Bonus Reactions</span>
				<span className="text-xs text-stone-400">{totalShown} / 84</span>
			</div>

			<input
				type="text"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Search animations…"
				className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:border-brand-400 focus:outline-none"
			/>

			<div className="flex max-h-96 flex-col gap-4 overflow-y-auto pr-1">
				{filtered.length === 0 && <p className="text-sm text-stone-400">No matches.</p>}
				{filtered.map(({ category, items }) => (
					<div key={category} className="flex flex-col gap-2">
						<span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{category}</span>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
							{items.map(({ id, label }) => (
								<button
									key={id}
									disabled={!connected}
									onClick={() => onCommand(`#TABY:${id}\n`, `TABY · ${id.toUpperCase()}`)}
									className="cursor-pointer truncate rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-2 text-left text-xs font-semibold text-stone-600 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-stone-50"
									title={label}
								>
									{label}
								</button>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
