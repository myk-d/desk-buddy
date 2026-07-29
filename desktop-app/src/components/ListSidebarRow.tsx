import { useRef, useState } from 'react';
import { Check, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';
import { menuItemClass, popoverClass } from '../lib/ui';
import type { TaskList } from '../types';

interface ListSidebarRowProps {
	list: TaskList;
	isActive: boolean;
	taskCount: number;
	canDelete: boolean;
	onSelect: () => void;
	onRename: (name: string) => void;
	onSetDefault: () => void;
	onDelete: () => void;
}

export function ListSidebarRow({
	list,
	isActive,
	taskCount,
	canDelete,
	onSelect,
	onRename,
	onSetDefault,
	onDelete,
}: ListSidebarRowProps) {
	const [editing, setEditing] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [draft, setDraft] = useState(list.name);
	const menuRef = useRef<HTMLDivElement>(null);
	useClickOutside(menuRef, () => setMenuOpen(false));

	const commitRename = () => {
		const trimmed = draft.trim();
		if (trimmed) onRename(trimmed);
		else setDraft(list.name);
		setEditing(false);
	};

	if (editing) {
		return (
			<div className="flex items-center gap-1">
				<input
					autoFocus
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={commitRename}
					onKeyDown={(e) => e.key === 'Enter' && commitRename()}
					className="w-full flex-1 rounded-xl bg-white px-3 py-2 text-sm outline-none ring-1 ring-brand-400"
				/>
				<button onClick={commitRename} className="shrink-0 rounded-full p-1 text-brand-600 hover:bg-brand-50" aria-label="Save">
					<Check size={15} />
				</button>
			</div>
		);
	}

	return (
		<div
			className={`group flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
				isActive ? 'bg-brand-100 text-brand-800 font-medium' : 'text-stone-600 hover:bg-stone-100'
			}`}
		>
			<button onClick={onSelect} className="flex flex-1 items-center gap-1.5 truncate text-left">
				{list.name}
				{list.isDefault && <Star size={11} className="shrink-0 fill-brand-400 text-brand-400" />}
			</button>
			<div className="relative flex items-center gap-1">
				{taskCount > 0 && <span className="text-xs text-stone-400 md:group-hover:hidden">{taskCount}</span>}
				<button
					onClick={() => setMenuOpen((v) => !v)}
					className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-600 md:hidden md:group-hover:block"
					aria-label="List menu"
				>
					<MoreHorizontal size={14} />
				</button>
				{menuOpen && (
					<div ref={menuRef} className={`${popoverClass} absolute right-0 top-6 z-30 w-40 p-1`}>
						<button
							onClick={() => {
								setDraft(list.name);
								setEditing(true);
								setMenuOpen(false);
							}}
							className={menuItemClass}
						>
							<Pencil size={14} /> Edit
						</button>
						{!list.isDefault && (
							<button
								onClick={() => {
									onSetDefault();
									setMenuOpen(false);
								}}
								className={menuItemClass}
							>
								<Star size={14} /> Set as default
							</button>
						)}
						{canDelete && (
							<button
								onClick={() => {
									onDelete();
									setMenuOpen(false);
								}}
								className={`${menuItemClass} text-red-500 hover:bg-red-50`}
							>
								<Trash2 size={14} /> Delete
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
