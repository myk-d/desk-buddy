import { useRef, useState } from 'react';
import { Copy, FolderInput, ListChecks, Pin, PinOff, Target, Trash2 } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';
import { useConfirm } from '../context/ConfirmContext';
import { PriorityPicker } from './ui/PriorityPicker';
import { TagPicker } from './ui/TagPicker';
import { DatePicker } from './ui/DatePicker';
import { RecurrencePicker } from './ui/RecurrencePicker';
import { menuItemClass, popoverClass } from '../lib/ui';
import type { Priority, RecurrenceRule, Tag, Task, TaskList } from '../types';

interface TaskContextMenuProps {
	task: Task;
	lists: TaskList[];
	allTags: Tag[];
	currentListId: string;
	onClose: () => void;
	onSetPriority: (p: Priority) => void;
	onSetDueDate: (d: string | null) => void;
	onSetRecurrence: (rule: RecurrenceRule | null) => void;
	onToggleTag: (tagId: string) => void;
	onCreateTag: (name: string) => void;
	onDeleteTag: (tagId: string) => void;
	onOpenDetail: () => void;
	onMoveToList: (listId: string) => void;
	onDuplicate: () => void;
	onDelete: () => void;
	onTogglePin: () => void;
	onRunFocus: () => void;
	// Which edge the popover anchors to and grows away from. Defaults to
	// 'right' (correct when the "..." trigger sits at the far right of a wide
	// row, e.g. TaskRow) — TaskDetailPanel's header trigger sits close to its
	// own left edge instead, where a right-anchored w-64 popover would overflow
	// past the panel's left edge.
	align?: 'left' | 'right';
}

export function TaskContextMenu({
	task,
	lists,
	allTags,
	currentListId,
	onClose,
	onSetPriority,
	onSetDueDate,
	onSetRecurrence,
	onToggleTag,
	onCreateTag,
	onDeleteTag,
	onOpenDetail,
	onMoveToList,
	onDuplicate,
	onDelete,
	onTogglePin,
	onRunFocus,
	align = 'right',
}: TaskContextMenuProps) {
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, onClose);
	const [showMoveTo, setShowMoveTo] = useState(false);
	const confirm = useConfirm();

	const handleDelete = async () => {
		if (
			await confirm({
				title: `Delete task "${task.text}"?`,
				confirmLabel: 'Delete',
			})
		) {
			onDelete();
		}
	};

	return (
		<div className={`${popoverClass} absolute top-8 z-20 w-64 p-2 text-sm ${align === 'left' ? 'left-0' : 'right-0'}`} ref={ref}>
			<div className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-stone-400">Priority</div>
			<div className="px-2 pb-2">
				<PriorityPicker value={task.priority} onChange={onSetPriority} />
			</div>

			<div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-stone-400">Date</div>
			<div className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
				<DatePicker value={task.dueDate} onChange={onSetDueDate} />
				<RecurrencePicker value={task.recurrence} anchorDate={task.dueDate} onChange={onSetRecurrence} />
			</div>

			<div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-stone-400">Tags</div>
			<div className="px-2 pb-2">
				<TagPicker
					selectedTagIds={task.tagIds}
					allTags={allTags}
					onToggle={onToggleTag}
					onCreate={onCreateTag}
					onDeleteTag={onDeleteTag}
				/>
			</div>

			<div className="my-1 border-t border-stone-100" />

			<button onClick={onRunFocus} className={menuItemClass}>
				<Target size={15} /> Start Focus
			</button>

			<button onClick={onTogglePin} className={menuItemClass}>
				{task.pinned ? <PinOff size={15} /> : <Pin size={15} />}
				{task.pinned ? 'Unpin' : 'Pin'}
			</button>

			<button onClick={onOpenDetail} className={menuItemClass}>
				<ListChecks size={15} /> Subtasks and details
			</button>

			<div className="relative">
				<button onClick={() => setShowMoveTo((v) => !v)} className={`${menuItemClass} justify-between`}>
					<span className="flex items-center gap-2">
						<FolderInput size={15} /> Move to
					</span>
					<span className="text-stone-400">›</span>
				</button>
				{showMoveTo && (
					<div className={`${popoverClass} absolute left-0 top-full mt-1 w-44 p-1`}>
						{lists.map((list) => (
							<button
								key={list.id}
								onClick={() => onMoveToList(list.id)}
								className={`${menuItemClass} justify-between`}
							>
								{list.name}
								{list.id === currentListId && <span className="text-brand-500">✓</span>}
							</button>
						))}
					</div>
				)}
			</div>

			<button onClick={onDuplicate} className={menuItemClass}>
				<Copy size={15} /> Duplicate
			</button>

			<div className="my-1 border-t border-stone-100" />

			<button onClick={handleDelete} className={`${menuItemClass} text-red-500 hover:bg-red-50`}>
				<Trash2 size={15} /> Delete
			</button>
		</div>
	);
}
