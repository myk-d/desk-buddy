import { useMemo, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Eye, EyeOff, Menu, Plus } from 'lucide-react';
import { useTaskStoreContext } from '../context/TaskStoreContext';
import { TaskSection } from './TaskSection';
import { GroupedTaskList } from './GroupedTaskList';
import { FilterMenu } from './FilterMenu';
import { groupTasksBy, sortTasksBy } from '../lib/utils';
import type { Task } from '../types';

interface TodoContainerProps {
	selectedTaskId: string | null;
	onSelectTask: (taskId: string) => void;
	onOpenSidebar: () => void;
}

export function TodoContainer({ selectedTaskId, onSelectTask, onOpenSidebar }: TodoContainerProps) {
	const { lists, sections, tasks, tags, activeListId, addSection, addTask, moveTask, reorderSection, setListGroupBy, setListSortBy } =
		useTaskStoreContext();
	const [hideCompleted, setHideCompleted] = useState(false);
	const [quickAddText, setQuickAddText] = useState('');

	const activeList = lists.find((l) => l.id === activeListId);
	const activeSections = useMemo(
		() => sections.filter((s) => s.listId === activeListId).sort((a, b) => a.order - b.order),
		[sections, activeListId]
	);
	const listTasks = useMemo(
		() => tasks.filter((t) => activeSections.some((s) => s.id === t.sectionId)),
		[tasks, activeSections]
	);
	const isGrouped = activeList ? activeList.groupBy !== 'sequence' : false;

	// Recomputing sort/group on every render (e.g. every keystroke while typing
	// in the quick-add input below) would hand GroupedTaskList/TaskSection a
	// brand-new array each time, defeating any memoization on those components
	// and re-rendering every row regardless of whether the underlying data
	// actually changed.
	const groupedGroups = useMemo(() => {
		if (!activeList || !isGrouped) return [];
		const base = hideCompleted ? listTasks.filter((t) => !t.completed) : listTasks;
		return groupTasksBy(base, activeList.groupBy, tags).map((group) => ({
			...group,
			tasks: sortTasksBy(group.tasks, activeList.sortBy, tags),
		}));
	}, [activeList, isGrouped, hideCompleted, listTasks, tags]);

	const sectionTasks = useMemo(() => {
		const map = new Map<string, Task[]>();
		if (!activeList) return map;
		activeSections.forEach((section) => {
			map.set(section.id, sortTasksBy(tasks.filter((t) => t.sectionId === section.id), activeList.sortBy, tags));
		});
		return map;
	}, [activeSections, tasks, activeList, tags]);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || !activeList) return;
		const activeData = active.data.current as { type?: string; sectionId?: string } | undefined;
		const overData = over.data.current as { type?: string; sectionId?: string } | undefined;
		if (activeData?.type !== 'task' || !overData?.sectionId) return;

		const fromSectionId = activeData.sectionId!;
		const toSectionId = overData.sectionId;

		if (fromSectionId === toSectionId) {
			const ids = sortTasksBy(tasks.filter((t) => t.sectionId === toSectionId), activeList.sortBy, tags).map((t) => t.id);
			const oldIndex = ids.indexOf(active.id as string);
			const newIndex = overData.type === 'task' ? ids.indexOf(over.id as string) : ids.length - 1;
			if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
			reorderSection(toSectionId, arrayMove(ids, oldIndex, newIndex));
		} else {
			const targetIds = sortTasksBy(tasks.filter((t) => t.sectionId === toSectionId), activeList.sortBy, tags).map((t) => t.id);
			const newIndex = overData.type === 'task' ? targetIds.indexOf(over.id as string) : targetIds.length;
			moveTask(active.id as string, toSectionId, newIndex);
		}
	};

	const commitQuickAdd = () => {
		const firstSectionId = activeSections[0]?.id;
		if (quickAddText.trim() && firstSectionId) addTask(firstSectionId, quickAddText.trim());
		setQuickAddText('');
	};

	if (!activeList) return null;

	return (
		<section className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto px-6 py-6">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<button
						onClick={onOpenSidebar}
						className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 md:hidden"
						aria-label="Lists"
					>
						<Menu size={18} />
					</button>
					<h1 className="text-xl font-bold text-stone-800">{activeList.name}</h1>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button
						onClick={() => setHideCompleted((v) => !v)}
						className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
							hideCompleted ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
						}`}
					>
						{hideCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
						{hideCompleted ? 'Completed hidden' : 'Show completed'}
					</button>
					{!isGrouped && (
						<button
							onClick={() => addSection(activeListId)}
							className="flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 hover:bg-stone-200"
						>
							<Plus size={13} /> Section
						</button>
					)}
					<FilterMenu
						groupBy={activeList.groupBy}
						sortBy={activeList.sortBy}
						onSetGroupBy={(groupBy) => setListGroupBy(activeList.id, groupBy)}
						onSetSortBy={(sortBy) => setListSortBy(activeList.id, sortBy)}
					/>
				</div>
			</div>

			{isGrouped ? (
				<>
					<div className="mb-3 flex items-center gap-1">
						<input
							value={quickAddText}
							onChange={(e) => setQuickAddText(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && commitQuickAdd()}
							onBlur={commitQuickAdd}
							placeholder="+ Add task"
							className="flex-1 rounded-lg bg-transparent px-2 py-1.5 text-sm text-stone-500 outline-none placeholder:text-stone-400 hover:bg-stone-50 focus:bg-stone-50"
						/>
						<button onClick={commitQuickAdd} className="shrink-0 rounded-full p-1.5 text-brand-600 hover:bg-brand-50" aria-label="Save">
							<Plus size={15} />
						</button>
					</div>
					<GroupedTaskList
						groups={groupedGroups}
						lists={lists}
						currentListId={activeList.id}
						selectedTaskId={selectedTaskId}
						onSelectTask={onSelectTask}
					/>
				</>
			) : (
				<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
					{activeSections.map((section) => (
						<TaskSection
							key={section.id}
							section={section}
							tasks={sectionTasks.get(section.id) ?? []}
							lists={lists}
							hideCompleted={hideCompleted}
							selectedTaskId={selectedTaskId}
							onSelectTask={onSelectTask}
						/>
					))}
				</DndContext>
			)}
		</section>
	);
}
