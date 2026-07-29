import { useRef, useState } from 'react';
import { Check, Search, Tag as TagIcon, Trash2, X } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useConfirm } from '../../context/ConfirmContext';
import { TAG_COLOR_META } from '../../lib/utils';
import { popoverClass, menuItemClass } from '../../lib/ui';
import type { Tag } from '../../types';

interface TagPickerProps {
	selectedTagIds: string[];
	allTags: Tag[];
	onToggle: (tagId: string) => void;
	onCreate: (name: string) => void;
	onDeleteTag: (tagId: string) => void;
}

export function TagPicker({ selectedTagIds, allTags, onToggle, onCreate, onDeleteTag }: TagPickerProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, () => setOpen(false));
	const confirm = useConfirm();

	const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));
	const normalizedQuery = query.trim().toLowerCase();
	const filtered = normalizedQuery ? allTags.filter((t) => t.name.toLowerCase().includes(normalizedQuery)) : allTags;
	const exactMatch = allTags.some((t) => t.name.toLowerCase() === normalizedQuery);

	const handleCreate = () => {
		if (!query.trim() || exactMatch) return;
		onCreate(query.trim());
		setQuery('');
	};

	const handleDeleteTag = async (tag: Tag) => {
		if (
			await confirm({
				title: `Delete tag "${tag.name}"?`,
				message: 'The tag will be removed from every task it was applied to.',
				confirmLabel: 'Delete',
			})
		) {
			onDeleteTag(tag.id);
		}
	};

	return (
		<div ref={ref} className="relative w-full">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-stone-200 px-2.5 py-1.5 text-left hover:border-stone-300"
			>
				{selectedTags.length === 0 ? (
					<span className="flex items-center gap-1.5 text-xs text-stone-400">
						<TagIcon size={13} /> Add tags
					</span>
				) : (
					selectedTags.map((tag) => (
						<span
							key={tag.id}
							className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLOR_META[tag.color].bg} ${TAG_COLOR_META[tag.color].text}`}
						>
							#{tag.name}
						</span>
					))
				)}
			</button>

			{open && (
				<div className={`${popoverClass} absolute left-0 top-10 z-30 w-64 p-2`}>
					<div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-200 px-2 py-1.5">
						<Search size={13} className="shrink-0 text-stone-400" />
						{selectedTags.map((tag) => (
							<span
								key={tag.id}
								className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLOR_META[tag.color].bg} ${TAG_COLOR_META[tag.color].text}`}
							>
								{tag.name}
								<button type="button" onClick={() => onToggle(tag.id)} className="hover:opacity-70">
									<X size={10} />
								</button>
							</span>
						))}
						<input
							autoFocus
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
							placeholder="Enter a tag"
							className="min-w-15 flex-1 bg-transparent text-xs outline-none placeholder:text-stone-400"
						/>
					</div>

					<div className="max-h-48 overflow-y-auto">
						{query.trim() && !exactMatch && (
							<button type="button" onClick={handleCreate} className={menuItemClass}>
								<TagIcon size={14} /> Create tag "{query.trim()}"
							</button>
						)}

						{filtered.length === 0 && !query.trim() && (
							<div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-stone-400">
								<TagIcon size={28} className="text-stone-200" />
								No tags
							</div>
						)}

						{filtered.map((tag) => (
							<div key={tag.id} className="group flex items-center">
								<button type="button" onClick={() => onToggle(tag.id)} className={`${menuItemClass} flex-1 justify-between`}>
									<span className="flex items-center gap-2">
										<span className={`h-2 w-2 rounded-full ${TAG_COLOR_META[tag.color].dot}`} />
										{tag.name}
									</span>
									{selectedTagIds.includes(tag.id) && <Check size={14} className="text-brand-600" />}
								</button>
								<button
									type="button"
									onClick={() => handleDeleteTag(tag)}
									className="shrink-0 rounded p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-500 md:hidden md:group-hover:block"
									aria-label="Delete tag"
								>
									<Trash2 size={13} />
								</button>
							</div>
						))}
					</div>

					<div className="mt-2 flex justify-end gap-2 border-t border-stone-100 pt-2">
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="rounded-full px-3 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
						>
							OK
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
