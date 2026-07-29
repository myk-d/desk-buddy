import { useState } from 'react';
import { useTaskStoreContext } from '../context/TaskStoreContext';
import { ListSidebar } from './ListSidebar';
import { TodoContainer } from './TodoContainer';
import { TagTasksView } from './TagTasksView';
import { TaskDetailPanel } from './TaskDetailPanel';

export function TasksPage() {
	const { tasks, lists, tags } = useTaskStoreContext();
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [activeTagIdPreference, setActiveTagId] = useState<string | null>(null);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const selectedTask = selectedTaskId ? (tasks.find((t) => t.id === selectedTaskId) ?? null) : null;
	// Derived, not raw: falls back out of tag view if the tag was deleted elsewhere.
	const activeTagId =
		activeTagIdPreference && tags.some((t) => t.id === activeTagIdPreference) ? activeTagIdPreference : null;

	return (
		<div className="flex h-full">
			<ListSidebar
				activeTagId={activeTagId}
				onSelectTag={setActiveTagId}
				onSelectList={() => setActiveTagId(null)}
				mobileOpen={sidebarOpen}
				onCloseMobile={() => setSidebarOpen(false)}
			/>
			{activeTagId ? (
				<TagTasksView
					tagId={activeTagId}
					selectedTaskId={selectedTaskId}
					onSelectTask={setSelectedTaskId}
					onOpenSidebar={() => setSidebarOpen(true)}
				/>
			) : (
				<TodoContainer
					selectedTaskId={selectedTaskId}
					onSelectTask={setSelectedTaskId}
					onOpenSidebar={() => setSidebarOpen(true)}
				/>
			)}
			{selectedTask && (
				<TaskDetailPanel key={selectedTask.id} task={selectedTask} lists={lists} onClose={() => setSelectedTaskId(null)} />
			)}
		</div>
	);
}
