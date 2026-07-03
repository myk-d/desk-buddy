import { useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { usePomodoros } from '../hooks/usePomodoros';
import { useTodos } from '../hooks/useTodos';
import { colors } from '../theme';
import type { PomodoroPreset } from '../types';

interface FormState {
	name: string;
	workMin: string;
	breakMin: string;
	sessions: string;
	linkedTaskId: string;
}

const EMPTY_FORM: FormState = { name: '', workMin: '25', breakMin: '5', sessions: '4', linkedTaskId: '' };

interface Props {
	activePresetId: string | null;
	onStart: (preset: PomodoroPreset) => void;
	onOpenRunner: () => void;
}

export function PomodoroListPage({ activePresetId, onStart, onOpenRunner }: Props) {
	const { presets, add, edit, remove } = usePomodoros();
	const { todos } = useTodos();
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [editingId, setEditingId] = useState<string | null>(null);

	function toPatch(f: FormState) {
		return {
			name: f.name.trim(),
			workMin: Math.max(1, Number(f.workMin) || 1),
			breakMin: Math.max(1, Number(f.breakMin) || 1),
			sessions: Math.max(1, Number(f.sessions) || 1),
			linkedTaskId: f.linkedTaskId || null,
		};
	}

	function submit(e: FormEvent) {
		e.preventDefault();
		if (!form.name.trim()) return;
		const patch = toPatch(form);
		if (editingId) {
			edit(editingId, patch);
			setEditingId(null);
		} else {
			add(patch);
		}
		setForm(EMPTY_FORM);
	}

	function startEdit(preset: PomodoroPreset) {
		setEditingId(preset.id);
		setForm({
			name: preset.name,
			workMin: String(preset.workMin),
			breakMin: String(preset.breakMin),
			sessions: String(preset.sessions),
			linkedTaskId: preset.linkedTaskId ?? '',
		});
	}

	function cancelEdit() {
		setEditingId(null);
		setForm(EMPTY_FORM);
	}

	const pendingTodos = todos.filter((t) => !t.completed);

	return (
		<>
			<div>
				<h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>Pomodoro Library</h1>
				<p style={{ color: colors.textMuted, marginTop: '6px', marginBottom: 0, fontSize: '16px' }}>
					Save presets with their own timing, run one at a time
				</p>
			</div>

			<form
				onSubmit={submit}
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: '16px',
					padding: '20px',
					backgroundColor: colors.surface,
					borderRadius: '12px',
					border: `1px solid ${colors.border}`,
				}}
			>
				<span style={{ fontSize: '13px', color: colors.textFaint, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
					{editingId ? 'Edit Preset' : 'New Preset'}
				</span>
				<div className="gb-config-grid" style={{ gap: '16px', alignItems: 'end' }}>
					<Field label="Name">
						<input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
					</Field>
					<Field label="Work (min)">
						<input type="number" min={1} max={120} value={form.workMin} onChange={(e) => setForm((p) => ({ ...p, workMin: e.target.value }))} style={inputStyle} />
					</Field>
					<Field label="Break (min)">
						<input type="number" min={1} max={60} value={form.breakMin} onChange={(e) => setForm((p) => ({ ...p, breakMin: e.target.value }))} style={inputStyle} />
					</Field>
					<Field label="Sessions">
						<input type="number" min={1} max={12} value={form.sessions} onChange={(e) => setForm((p) => ({ ...p, sessions: e.target.value }))} style={inputStyle} />
					</Field>
				</div>
				<Field label="Link to task (optional)">
					<select
						value={form.linkedTaskId}
						onChange={(e) => setForm((p) => ({ ...p, linkedTaskId: e.target.value }))}
						style={inputStyle}
					>
						<option value="">None</option>
						{pendingTodos.map((t) => (
							<option key={t.id} value={t.id}>{t.title}</option>
						))}
					</select>
				</Field>
				<div style={{ display: 'flex', gap: '8px' }}>
					<button type="submit" disabled={!form.name.trim()} style={addButtonStyle(!!form.name.trim())}>
						{editingId ? 'Save Preset' : 'Add Preset'}
					</button>
					{editingId && (
						<button type="button" onClick={cancelEdit} style={ghostButtonStyle}>
							Cancel
						</button>
					)}
				</div>
			</form>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
				{presets.length === 0 ? (
					<span style={{ color: colors.border, fontSize: '14px' }}>No presets yet — create one above.</span>
				) : (
					presets.map((preset) => {
						const isActive = preset.id === activePresetId;
						const blockedByOther = activePresetId !== null && !isActive;
						const linkedTask = todos.find((t) => t.id === preset.linkedTaskId);

						return (
							<div
								key={preset.id}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '14px',
									padding: '16px 20px',
									backgroundColor: colors.surface,
									borderRadius: '10px',
									border: `1px solid ${isActive ? colors.accent : colors.border}`,
								}}
							>
								<div style={{ flexGrow: 1 }}>
									<div style={{ fontSize: '15px', fontWeight: 600, color: colors.textPrimary }}>{preset.name}</div>
									<div style={{ fontSize: '13px', color: colors.textFaint, marginTop: '4px' }}>
										{preset.workMin}min focus · {preset.breakMin}min break · {preset.sessions} sessions
										{linkedTask && ` · linked: ${linkedTask.title}`}
									</div>
								</div>
								<div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
									{isActive ? (
										<button onClick={onOpenRunner} style={addButtonStyle(true)}>
											View Timer
										</button>
									) : (
										<button
											disabled={blockedByOther}
											onClick={() => onStart(preset)}
											style={addButtonStyle(!blockedByOther)}
										>
											{blockedByOther ? 'Running…' : 'Start'}
										</button>
									)}
									<button onClick={() => startEdit(preset)} style={ghostButtonStyle}>Edit</button>
									<button
										disabled={isActive}
										onClick={() => remove(preset.id)}
										style={{ ...ghostButtonStyle, color: isActive ? colors.textDisabled : colors.error, cursor: isActive ? 'not-allowed' : 'pointer' }}
									>
										Delete
									</button>
								</div>
							</div>
						);
					})
				)}
			</div>
		</>
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
			<label style={{ fontSize: '12px', color: colors.textFaint }}>{label}</label>
			{children}
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
	width: '100%',
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
		whiteSpace: 'nowrap',
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
