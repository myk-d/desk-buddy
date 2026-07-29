import { useRef, useState } from 'react';
import { Check, MoreHorizontal, Pencil, Tag as TagIcon, Trash2 } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';
import { TAG_COLOR_META, TAG_COLOR_ORDER } from '../lib/utils';
import { menuItemClass, popoverClass } from '../lib/ui';
import type { Tag, TagColor } from '../types';

interface TagSidebarRowProps {
	tag: Tag;
	isActive: boolean;
	onSelect: () => void;
	onRename: (name: string) => void;
	onRecolor: (color: TagColor) => void;
	onDelete: () => void;
}

export function TagSidebarRow({ tag, isActive, onSelect, onRename, onRecolor, onDelete }: TagSidebarRowProps) {
	const [editing, setEditing] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [draft, setDraft] = useState(tag.name);
	const menuRef = useRef<HTMLDivElement>(null);
	const editRef = useRef<HTMLDivElement>(null);
	useClickOutside(menuRef, () => setMenuOpen(false));

	const commitRename = () => {
		const trimmed = draft.trim();
		if (trimmed) onRename(trimmed);
		else setDraft(tag.name);
		setEditing(false);
	};

	// Committing on blur would fire before a color swatch's click (blur steals
	// focus first), unmounting the swatches before the click registers — commit
	// on click-outside of the whole editing block instead.
	useClickOutside(editRef, () => {
		if (editing) commitRename();
	});

	if (editing) {
		return (
			<div ref={editRef} className="rounded-xl px-3 py-2">
				<div className="flex items-center gap-1">
					<input
						autoFocus
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && commitRename()}
						className="w-full flex-1 rounded bg-stone-50 px-1 text-sm outline-none ring-1 ring-brand-400"
					/>
					<button onClick={commitRename} className="shrink-0 rounded-full p-1 text-brand-600 hover:bg-brand-50" aria-label="Save">
						<Check size={14} />
					</button>
				</div>
				<div className="mt-1.5 flex items-center gap-1.5">
					{TAG_COLOR_ORDER.map((color) => (
						<button
							key={color}
							onClick={() => onRecolor(color)}
							className={`h-4 w-4 rounded-full ${TAG_COLOR_META[color].dot} ${
								tag.color === color ? 'ring-2 ring-offset-1 ring-stone-400' : ''
							}`}
							aria-label={color}
						/>
					))}
				</div>
			</div>
		);
	}

	return (
		<div
			className={`group flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
				isActive ? 'bg-brand-100 text-brand-800 font-medium' : 'text-stone-600 hover:bg-stone-100'
			}`}
		>
			<button onClick={onSelect} className="flex flex-1 items-center gap-2 truncate text-left">
				<TagIcon size={14} className="shrink-0 text-stone-400" />
				<span className="truncate">{tag.name}</span>
			</button>
			<div className="relative flex items-center gap-1">
				<span className={`h-2 w-2 shrink-0 rounded-full ${TAG_COLOR_META[tag.color].dot} md:group-hover:hidden`} />
				<button
					onClick={() => setMenuOpen((v) => !v)}
					className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-600 md:hidden md:group-hover:block"
					aria-label="Tag menu"
				>
					<MoreHorizontal size={14} />
				</button>
				{menuOpen && (
					<div ref={menuRef} className={`${popoverClass} absolute right-0 top-6 z-30 w-40 p-1`}>
						<button
							onClick={() => {
								setDraft(tag.name);
								setEditing(true);
								setMenuOpen(false);
							}}
							className={menuItemClass}
						>
							<Pencil size={14} /> Edit
						</button>
						<button
							onClick={() => {
								onDelete();
								setMenuOpen(false);
							}}
							className={`${menuItemClass} text-red-500 hover:bg-red-50`}
						>
							<Trash2 size={14} /> Delete
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
