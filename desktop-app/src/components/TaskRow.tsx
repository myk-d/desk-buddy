import { memo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlignLeft, Flag, GripVertical, MoreHorizontal, Pin } from 'lucide-react';
import { useTaskStoreContext } from '../context/TaskStoreContext';
import { usePomodoroActions } from '../context/PomodoroContext';
import { Checkbox } from './ui/Checkbox';
import { TaskContextMenu } from './TaskContextMenu';
import { PRIORITY_META, TAG_COLOR_META, formatDueDate, isOverdue } from '../lib/utils';
import type { Task, TaskList } from '../types';

interface TaskRowProps {
	task: Task;
	lists: TaskList[];
	currentListId: string;
	isSelected: boolean;
	onSelect: (taskId: string) => void;
}

// Memoized so selecting a different task (which changes `isSelected` for at
// most two rows) doesn't re-render every other row in the list too.
export const TaskRow = memo(function TaskRow({ task, lists, currentListId, isSelected, onSelect }: TaskRowProps) {
	const {
		tags,
		toggleTaskCompleted,
		deleteTask,
		duplicateTask,
		moveTaskToList,
		setPriority,
		setDueDate,
		setTaskRecurrence,
		createTag,
		deleteTag,
		toggleTaskTag,
		togglePin,
	} = useTaskStoreContext();
	const { startForTask } = usePomodoroActions();

	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: task.id,
		data: { type: 'task', sectionId: task.sectionId },
	});

	const [menuOpen, setMenuOpen] = useState(false);

	const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
	const dueOverdue = task.dueDate && !task.completed && isOverdue(task.dueDate);

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`group rounded-xl border bg-white px-1 transition-colors hover:border-stone-200 ${
				isSelected ? 'border-brand-300 bg-brand-50/40' : 'border-transparent'
			}`}
		>
			<div className="flex items-center gap-2.5 py-2.5">
				<button
					{...attributes}
					{...listeners}
					style={{ touchAction: 'none' }}
					className="cursor-grab text-stone-300 hover:text-stone-500 active:cursor-grabbing"
					aria-label="Drag"
				>
					<GripVertical size={15} />
				</button>
				<Checkbox checked={task.completed} onChange={() => toggleTaskCompleted(task.id)} />
				{task.priority !== 'none' && (
					<Flag size={15} className={`shrink-0 ${PRIORITY_META[task.priority].colorClass}`} fill="currentColor" />
				)}

				<button onClick={() => onSelect(task.id)} className="min-w-0 flex-1 text-left">
					<div className="flex items-center gap-1.5">
						<span className={`text-sm ${task.completed ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
							{task.text}
						</span>
						{task.pinned && <Pin size={12} className="shrink-0 rotate-45 text-stone-400" />}
					</div>

					{(task.dueDate || task.tagIds.length > 0 || task.subtasks.length > 0 || task.description.trim()) && (
						<div className="mt-1 flex flex-wrap items-center gap-1.5">
							{task.description.trim() && <AlignLeft size={12} className="shrink-0 text-stone-400" aria-label="Description" />}
							{task.dueDate && (
								<span
									className={`rounded-full px-2 py-0.5 text-xs ${dueOverdue ? 'bg-red-50 text-red-500' : 'bg-stone-100 text-stone-500'}`}
								>
									{formatDueDate(task.dueDate)}
								</span>
							)}
							{task.tagIds.map((tagId) => {
								const tag = tags.find((t) => t.id === tagId);
								if (!tag) return null;
								return (
									<span
										key={tagId}
										className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLOR_META[tag.color].bg} ${TAG_COLOR_META[tag.color].text}`}
									>
										#{tag.name}
									</span>
								);
							})}
							{task.subtasks.length > 0 && (
								<span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
									{completedSubtasks}/{task.subtasks.length}
								</span>
							)}
						</div>
					)}
				</button>

				<div className="relative">
					<button
						onClick={() => setMenuOpen((v) => !v)}
						className="rounded px-1.5 py-1 text-stone-400 opacity-100 hover:bg-stone-100 hover:text-stone-600 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
					>
						<MoreHorizontal size={16} />
					</button>
					{menuOpen && (
						<TaskContextMenu
							task={task}
							lists={lists}
							allTags={tags}
							currentListId={currentListId}
							onClose={() => setMenuOpen(false)}
							onSetPriority={(p) => setPriority(task.id, p)}
							onSetDueDate={(d) => setDueDate(task.id, d)}
							onSetRecurrence={(rule) => setTaskRecurrence(task.id, rule)}
							onToggleTag={(tagId) => toggleTaskTag(task.id, tagId)}
							onCreateTag={(name) => toggleTaskTag(task.id, createTag(name))}
							onDeleteTag={deleteTag}
							onOpenDetail={() => {
								onSelect(task.id);
								setMenuOpen(false);
							}}
							onMoveToList={(listId) => {
								moveTaskToList(task.id, listId);
								setMenuOpen(false);
							}}
							onDuplicate={() => {
								duplicateTask(task.id);
								setMenuOpen(false);
							}}
							onDelete={() => {
								deleteTask(task.id);
								setMenuOpen(false);
							}}
							onTogglePin={() => {
								togglePin(task.id);
								setMenuOpen(false);
							}}
							onRunFocus={() => {
								startForTask(task.id);
								setMenuOpen(false);
							}}
						/>
					)}
				</div>
			</div>
		</div>
	);
});
