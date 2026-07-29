import { TaskRow } from './TaskRow';
import type { TaskGroup } from '../lib/utils';
import type { TaskList } from '../types';

interface GroupedTaskListProps {
	groups: TaskGroup[];
	lists: TaskList[];
	currentListId: string;
	selectedTaskId: string | null;
	onSelectTask: (taskId: string) => void;
}

// Rendered when a list's Group by is anything other than "sequence" — tasks
// are pooled from every section and re-bucketed by the chosen dimension, so
// there's no meaningful drag-and-drop order here (unlike TaskSection/TaskRow's
// normal DnD-backed rendering).
export function GroupedTaskList({ groups, lists, currentListId, selectedTaskId, onSelectTask }: GroupedTaskListProps) {
	return (
		<div className="flex flex-col gap-3">
			{groups.map((group) => (
				<div key={group.key}>
					{group.label && (
						<div className="flex items-center gap-2 px-1 py-1">
							<span className="text-sm font-semibold text-stone-700">{group.label}</span>
							<span className="text-xs text-stone-400">{group.tasks.length}</span>
						</div>
					)}
					<div className="flex flex-col gap-2 px-1 py-1">
						{group.tasks.map((task) => (
							<TaskRow
								key={task.id}
								task={task}
								lists={lists}
								currentListId={currentListId}
								isSelected={task.id === selectedTaskId}
								onSelect={onSelectTask}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
