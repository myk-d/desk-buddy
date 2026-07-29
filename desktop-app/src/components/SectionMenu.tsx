import { useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, FolderInput, Pencil, Trash2 } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';
import { useConfirm } from '../context/ConfirmContext';
import { menuItemClass, popoverClass } from '../lib/ui';
import type { TaskList } from '../types';

interface SectionMenuProps {
	lists: TaskList[];
	currentListId: string;
	canDelete: boolean;
	onClose: () => void;
	onRename: () => void;
	onInsertAbove: () => void;
	onInsertBelow: () => void;
	onMoveToList: (listId: string) => void;
	onDelete: () => void;
}

export function SectionMenu({
	lists,
	currentListId,
	canDelete,
	onClose,
	onRename,
	onInsertAbove,
	onInsertBelow,
	onMoveToList,
	onDelete,
}: SectionMenuProps) {
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, onClose);
	const [showMoveTo, setShowMoveTo] = useState(false);
	const otherLists = lists.filter((l) => l.id !== currentListId);
	const confirm = useConfirm();

	const handleDelete = async () => {
		if (
			await confirm({
				title: 'Delete section?',
				message: 'Tasks in this section will be moved to another section in the list.',
				confirmLabel: 'Delete',
			})
		) {
			onDelete();
		}
	};

	return (
		<div ref={ref} className={`${popoverClass} absolute right-0 top-8 z-20 w-56 p-1 text-sm`}>
			<button onClick={onRename} className={menuItemClass}>
				<Pencil size={15} /> Rename
			</button>
			<button onClick={onInsertAbove} className={menuItemClass}>
				<ArrowUpToLine size={15} /> Insert section above
			</button>
			<button onClick={onInsertBelow} className={menuItemClass}>
				<ArrowDownToLine size={15} /> Insert section below
			</button>

			{otherLists.length > 0 && (
				<div className="relative">
					<button onClick={() => setShowMoveTo((v) => !v)} className={`${menuItemClass} justify-between`}>
						<span className="flex items-center gap-2">
							<FolderInput size={15} /> Move to
						</span>
						<span className="text-stone-400">›</span>
					</button>
					{showMoveTo && (
						<div className={`${popoverClass} absolute left-0 top-full mt-1 w-44 p-1`}>
							{otherLists.map((list) => (
								<button key={list.id} onClick={() => onMoveToList(list.id)} className={menuItemClass}>
									{list.name}
								</button>
							))}
						</div>
					)}
				</div>
			)}

			<div className="my-1 border-t border-stone-100" />

			<button
				onClick={handleDelete}
				disabled={!canDelete}
				className={`${menuItemClass} text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent`}
			>
				<Trash2 size={15} /> Delete section
			</button>
		</div>
	);
}
