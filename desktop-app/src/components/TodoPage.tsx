import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useTodos } from '../hooks/useTodos';
import { colors } from '../theme';

export function TodoPage() {
	const { todos, add, edit, toggleComplete, remove } = useTodos();
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState('');
	const [editDescription, setEditDescription] = useState('');

	function submitNew(e: FormEvent) {
		e.preventDefault();
		if (!title.trim()) return;
		add(title.trim(), description.trim() || undefined);
		setTitle('');
		setDescription('');
	}

	function startEdit(id: string, currentTitle: string, currentDescription?: string) {
		setEditingId(id);
		setEditTitle(currentTitle);
		setEditDescription(currentDescription ?? '');
	}

	function submitEdit(e: FormEvent) {
		e.preventDefault();
		if (!editingId || !editTitle.trim()) return;
		edit(editingId, { title: editTitle.trim(), description: editDescription.trim() || undefined });
		setEditingId(null);
	}

	const pending = todos.filter((t) => !t.completed);
	const completed = todos.filter((t) => t.completed);

	return (
		<>
			<div>
				<h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>Todo List</h1>
				<p style={{ color: colors.textMuted, marginTop: '6px', marginBottom: 0, fontSize: '16px' }}>
					Track tasks — link them to a Pomodoro preset to auto-complete on focus
				</p>
			</div>

			<form
				onSubmit={submitNew}
				style={{
					display: 'flex',
					gap: '12px',
					flexWrap: 'wrap',
					padding: '20px',
					backgroundColor: colors.surface,
					borderRadius: '12px',
					border: `1px solid ${colors.border}`,
				}}
			>
				<input
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="New task title"
					style={{ ...inputStyle, flex: '1 1 200px' }}
				/>
				<input
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Description (optional)"
					style={{ ...inputStyle, flex: '2 1 260px' }}
				/>
				<button type="submit" disabled={!title.trim()} style={addButtonStyle(!!title.trim())}>
					Add Task
				</button>
			</form>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
				<TaskGroup
					label="Pending"
					items={pending}
					editingId={editingId}
					editTitle={editTitle}
					editDescription={editDescription}
					onEditTitleChange={setEditTitle}
					onEditDescriptionChange={setEditDescription}
					onSubmitEdit={submitEdit}
					onCancelEdit={() => setEditingId(null)}
					onStartEdit={startEdit}
					onToggle={toggleComplete}
					onRemove={remove}
				/>
				<TaskGroup
					label="Completed"
					items={completed}
					editingId={editingId}
					editTitle={editTitle}
					editDescription={editDescription}
					onEditTitleChange={setEditTitle}
					onEditDescriptionChange={setEditDescription}
					onSubmitEdit={submitEdit}
					onCancelEdit={() => setEditingId(null)}
					onStartEdit={startEdit}
					onToggle={toggleComplete}
					onRemove={remove}
				/>
			</div>
		</>
	);
}

interface Task {
	id: string;
	title: string;
	description?: string;
	completed: boolean;
}

interface TaskGroupProps {
	label: string;
	items: Task[];
	editingId: string | null;
	editTitle: string;
	editDescription: string;
	onEditTitleChange: (v: string) => void;
	onEditDescriptionChange: (v: string) => void;
	onSubmitEdit: (e: FormEvent) => void;
	onCancelEdit: () => void;
	onStartEdit: (id: string, title: string, description?: string) => void;
	onToggle: (id: string) => void;
	onRemove: (id: string) => void;
}

function TaskGroup({
	label, items, editingId, editTitle, editDescription,
	onEditTitleChange, onEditDescriptionChange, onSubmitEdit, onCancelEdit,
	onStartEdit, onToggle, onRemove,
}: TaskGroupProps) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
			<span style={{ fontSize: '13px', color: colors.textFaint, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
				{label} ({items.length})
			</span>
			{items.length === 0 ? (
				<span style={{ color: colors.border, fontSize: '14px' }}>Nothing here yet.</span>
			) : (
				items.map((task) => (
					<div
						key={task.id}
						style={{
							display: 'flex',
							alignItems: 'flex-start',
							gap: '14px',
							padding: '16px 20px',
							backgroundColor: colors.surface,
							borderRadius: '10px',
							border: `1px solid ${colors.border}`,
						}}
					>
						<input
							type="checkbox"
							checked={task.completed}
							onChange={() => onToggle(task.id)}
							style={{ marginTop: '4px', width: '16px', height: '16px', accentColor: colors.accent, cursor: 'pointer' }}
						/>

						{editingId === task.id ? (
							<form onSubmit={onSubmitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
								<input value={editTitle} onChange={(e) => onEditTitleChange(e.target.value)} style={inputStyle} />
								<input value={editDescription} onChange={(e) => onEditDescriptionChange(e.target.value)} style={inputStyle} placeholder="Description" />
								<div style={{ display: 'flex', gap: '8px' }}>
									<button type="submit" style={addButtonStyle(true)}>Save</button>
									<button type="button" onClick={onCancelEdit} style={ghostButtonStyle}>Cancel</button>
								</div>
							</form>
						) : (
							<>
								<div style={{ flexGrow: 1 }}>
									<div style={{
										fontSize: '15px', fontWeight: 600,
										color: task.completed ? colors.textDisabled : colors.textPrimary,
										textDecoration: task.completed ? 'line-through' : 'none',
									}}>
										{task.title}
									</div>
									{task.description && (
										<div style={{ fontSize: '13px', color: colors.textFaint, marginTop: '4px' }}>
											{task.description}
										</div>
									)}
								</div>
								<div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
									<button onClick={() => onStartEdit(task.id, task.title, task.description)} style={ghostButtonStyle}>
										Edit
									</button>
									<button onClick={() => onRemove(task.id)} style={{ ...ghostButtonStyle, color: colors.error }}>
										Delete
									</button>
								</div>
							</>
						)}
					</div>
				))
			)}
		</div>
	);
}

const inputStyle: CSSProperties = {
	padding: '10px 14px',
	borderRadius: '8px',
	border: `1px solid ${colors.border}`,
	backgroundColor: colors.bg,
	color: colors.textPrimary,
	fontSize: '14px',
	outline: 'none',
	boxSizing: 'border-box',
};

function addButtonStyle(enabled: boolean): CSSProperties {
	return {
		padding: '10px 20px',
		borderRadius: '8px',
		border: 'none',
		backgroundColor: enabled ? colors.accent : colors.border,
		color: enabled ? colors.textPrimary : colors.textDisabled,
		fontSize: '14px',
		fontWeight: 600,
		cursor: enabled ? 'pointer' : 'not-allowed',
	};
}

const ghostButtonStyle: CSSProperties = {
	padding: '8px 14px',
	borderRadius: '8px',
	border: `1px solid ${colors.border}`,
	backgroundColor: 'transparent',
	color: colors.textMuted,
	fontSize: '13px',
	cursor: 'pointer',
};
