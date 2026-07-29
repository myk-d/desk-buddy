import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTaskStoreContext } from '../context/TaskStoreContext';
import { useConfirm } from '../context/ConfirmContext';
import { Checkbox } from './ui/Checkbox';
import type { Subtask } from '../types';

interface SubtaskListProps {
	taskId: string;
	subtasks: Subtask[];
}

function SubtaskRow({
	subtask,
	onToggle,
	onUpdate,
	onDelete,
}: {
	subtask: Subtask;
	onToggle: () => void;
	onUpdate: (text: string) => void;
	onDelete: () => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(subtask.text);

	const commitEdit = () => {
		const trimmed = draft.trim();
		if (trimmed) onUpdate(trimmed);
		else setDraft(subtask.text);
		setEditing(false);
	};

	return (
		<div className="group flex items-center gap-2">
			<Checkbox size="sm" checked={subtask.completed} onChange={onToggle} />
			{editing ? (
				<input
					autoFocus
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={commitEdit}
					onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
					className="flex-1 rounded bg-stone-50 px-1 text-sm outline-none ring-1 ring-brand-400"
				/>
			) : (
				<button
					onClick={() => {
						setDraft(subtask.text);
						setEditing(true);
					}}
					className={`flex-1 truncate text-left text-sm ${subtask.completed ? 'text-stone-400 line-through' : 'text-stone-600'}`}
				>
					{subtask.text}
				</button>
			)}
			<button onClick={onDelete} className="text-stone-300 hover:text-red-500 md:hidden md:group-hover:block">
				<X size={13} />
			</button>
		</div>
	);
}

export function SubtaskList({ taskId, subtasks }: SubtaskListProps) {
	const { addSubtask, updateSubtask, toggleSubtask, deleteSubtask } = useTaskStoreContext();
	const [newSubtask, setNewSubtask] = useState('');
	const confirm = useConfirm();

	const commitNewSubtask = () => {
		if (newSubtask.trim()) addSubtask(taskId, newSubtask.trim());
		setNewSubtask('');
	};

	const handleDelete = async (subtask: Subtask) => {
		if (await confirm({ title: `Delete subtask "${subtask.text}"?`, confirmLabel: 'Delete' })) {
			deleteSubtask(taskId, subtask.id);
		}
	};

	return (
		<div className="flex flex-col gap-1.5">
			{subtasks.map((st) => (
				<SubtaskRow
					key={st.id}
					subtask={st}
					onToggle={() => toggleSubtask(taskId, st.id)}
					onUpdate={(text) => updateSubtask(taskId, st.id, text)}
					onDelete={() => handleDelete(st)}
				/>
			))}
			<div className="flex items-center gap-1">
				<input
					value={newSubtask}
					onChange={(e) => setNewSubtask(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && commitNewSubtask()}
					onBlur={commitNewSubtask}
					placeholder="+ subtask"
					className="flex-1 rounded bg-stone-50 px-1.5 py-1 text-sm outline-none placeholder:text-stone-400"
				/>
				<button onClick={commitNewSubtask} className="shrink-0 rounded-full p-1 text-brand-600 hover:bg-brand-50" aria-label="Save">
					<Plus size={14} />
				</button>
			</div>
		</div>
	);
}
