import { Menu, Tag as TagIcon } from 'lucide-react';
import { useTaskStoreContext } from '../context/TaskStoreContext';
import { TaskRow } from './TaskRow';
import { sortTasksForDisplay, TAG_COLOR_META } from '../lib/utils';

interface TagTasksViewProps {
	tagId: string;
	selectedTaskId: string | null;
	onSelectTask: (taskId: string) => void;
	onOpenSidebar: () => void;
}

export function TagTasksView({ tagId, selectedTaskId, onSelectTask, onOpenSidebar }: TagTasksViewProps) {
	const { tags, tasks, sections, lists } = useTaskStoreContext();
	const tag = tags.find((t) => t.id === tagId);
	const taggedTasks = sortTasksForDisplay(tasks.filter((t) => t.tagIds.includes(tagId)));

	const groups = lists
		.map((list) => {
			const sectionIds = new Set(sections.filter((s) => s.listId === list.id).map((s) => s.id));
			return { list, tasks: taggedTasks.filter((t) => sectionIds.has(t.sectionId)) };
		})
		.filter((g) => g.tasks.length > 0);

	if (!tag) return null;

	return (
		<section className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto px-6 py-6">
			<div className="mb-4 flex items-center gap-2">
				<button
					onClick={onOpenSidebar}
					className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 md:hidden"
					aria-label="Lists"
				>
					<Menu size={18} />
				</button>
				<TagIcon size={18} className={TAG_COLOR_META[tag.color].text} />
				<h1 className="text-xl font-bold text-stone-800">{tag.name}</h1>
			</div>

			{groups.length === 0 ? (
				<p className="mt-4 text-sm text-stone-400">No tasks with this tag.</p>
			) : (
				groups.map(({ list, tasks: listTasks }) => (
					<div key={list.id} className="mb-3">
						<div className="flex items-center gap-2 px-1 py-1">
							<span className="text-sm font-semibold text-stone-700">{list.name}</span>
							<span className="text-xs text-stone-400">{listTasks.length}</span>
						</div>
						<div className="flex flex-col gap-2 px-1 py-1">
							{listTasks.map((task) => (
								<TaskRow
									key={task.id}
									task={task}
									lists={lists}
									currentListId={list.id}
									isSelected={task.id === selectedTaskId}
									onSelect={onSelectTask}
								/>
							))}
						</div>
					</div>
				))
			)}
		</section>
	);
}
