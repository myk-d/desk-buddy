import { useState } from 'react';
import { Check, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { Switch } from './ui/Switch';
import { inputClass } from '../lib/ui';
import type { PomodoroPreset } from '../types';

interface PomodoroPresetListProps {
	presets: PomodoroPreset[];
	activePresetId: string | null;
	isActive: boolean;
	onRun: (presetId: string) => void;
	onAdd: (preset: Omit<PomodoroPreset, 'id' | 'createdAt' | 'updatedAt'>) => void;
	onUpdate: (id: string, patch: Partial<Omit<PomodoroPreset, 'id'>>) => void;
	onDelete: (id: string) => void;
}

interface PresetFormValue {
	name: string;
	focusMinutes: number;
	shortBreakMinutes: number;
	longBreakMinutes: number;
	sessionsBeforeLongBreak: number;
	autoStartNext: boolean;
}

const EMPTY_FORM: PresetFormValue = {
	name: '',
	focusMinutes: 25,
	shortBreakMinutes: 5,
	longBreakMinutes: 15,
	sessionsBeforeLongBreak: 4,
	autoStartNext: true,
};

function PresetForm({
	value,
	onChange,
	onSave,
	onCancel,
}: {
	value: PresetFormValue;
	onChange: (v: PresetFormValue) => void;
	onSave: () => void;
	onCancel: () => void;
}) {
	const numberField = (label: string, key: keyof Omit<PresetFormValue, 'name' | 'autoStartNext'>, min: number, max: number) => (
		<label className="flex items-center justify-between gap-2 text-xs text-stone-500">
			{label}
			<input
				type="number"
				min={min}
				max={max}
				value={value[key]}
				onChange={(e) => onChange({ ...value, [key]: Math.max(min, Math.min(max, Number(e.target.value) || min)) })}
				className={`${inputClass} w-14 py-1 text-right text-xs`}
			/>
		</label>
	);

	return (
		<div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
			<input
				autoFocus
				value={value.name}
				onChange={(e) => onChange({ ...value, name: e.target.value })}
				placeholder="Preset name"
				className={`${inputClass} w-full`}
			/>
			<div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
				{numberField('Focus, min', 'focusMinutes', 1, 120)}
				{numberField('Short break, min', 'shortBreakMinutes', 1, 60)}
				{numberField('Long break, min', 'longBreakMinutes', 1, 60)}
				{numberField('Sessions before long', 'sessionsBeforeLongBreak', 1, 12)}
			</div>
			<div className="flex items-center justify-between gap-2 border-t border-stone-200 pt-2 text-xs text-stone-500">
				Auto-start next phase
				<Switch checked={value.autoStartNext} onChange={(v) => onChange({ ...value, autoStartNext: v })} />
			</div>
			<div className="flex justify-end gap-2 pt-1">
				<button onClick={onCancel} className="rounded-full px-3 py-1 text-xs font-medium text-stone-500 hover:bg-stone-200">
					Cancel
				</button>
				<button
					onClick={onSave}
					disabled={!value.name.trim()}
					className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Save
				</button>
			</div>
		</div>
	);
}

export function PomodoroPresetList({
	presets,
	activePresetId,
	isActive,
	onRun,
	onAdd,
	onUpdate,
	onDelete,
}: PomodoroPresetListProps) {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [isAdding, setIsAdding] = useState(false);
	const [form, setForm] = useState<PresetFormValue>(EMPTY_FORM);
	const [confirmingId, setConfirmingId] = useState<string | null>(null);
	const confirm = useConfirm();

	const handleDeleteClick = async (preset: PomodoroPreset) => {
		if (await confirm({ title: `Delete preset "${preset.name}"?`, confirmLabel: 'Delete' })) {
			onDelete(preset.id);
		}
	};

	const startEdit = (preset: PomodoroPreset) => {
		setEditingId(preset.id);
		setIsAdding(false);
		setForm({
			name: preset.name,
			focusMinutes: preset.focusMinutes,
			shortBreakMinutes: preset.shortBreakMinutes,
			longBreakMinutes: preset.longBreakMinutes,
			sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
			autoStartNext: preset.autoStartNext,
		});
	};

	const startAdd = () => {
		setIsAdding(true);
		setEditingId(null);
		setForm(EMPTY_FORM);
	};

	const saveEdit = () => {
		if (!form.name.trim()) return;
		if (editingId) onUpdate(editingId, form);
		else onAdd(form);
		setEditingId(null);
		setIsAdding(false);
	};

	const handleRunClick = (presetId: string) => {
		if (isActive && activePresetId !== presetId) {
			setConfirmingId(presetId);
			return;
		}
		onRun(presetId);
	};

	return (
		<div className="w-full max-w-sm">
			<div className="mb-2 flex items-center justify-between">
				<h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">Presets</h2>
				<button onClick={startAdd} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
					<Plus size={14} /> Add
				</button>
			</div>

			<div className="flex flex-col gap-2">
				{isAdding && <PresetForm value={form} onChange={setForm} onSave={saveEdit} onCancel={() => setIsAdding(false)} />}

				{presets.map((preset) =>
					editingId === preset.id ? (
						<PresetForm key={preset.id} value={form} onChange={setForm} onSave={saveEdit} onCancel={() => setEditingId(null)} />
					) : (
						<div
							key={preset.id}
							className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition ${
								activePresetId === preset.id && isActive ? 'border-brand-300 bg-brand-50' : 'border-stone-200 bg-white'
							}`}
						>
							{confirmingId === preset.id ? (
								<div className="flex w-full items-center justify-between gap-2">
									<span className="text-xs text-stone-500">Stop the current one and start this?</span>
									<div className="flex items-center gap-1">
										<button
											onClick={() => {
												onRun(preset.id);
												setConfirmingId(null);
											}}
											className="flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
										>
											<Check size={12} /> Yes
										</button>
										<button
											onClick={() => setConfirmingId(null)}
											className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500 hover:bg-stone-200"
										>
											<X size={12} />
										</button>
									</div>
								</div>
							) : (
								<>
									<div className="min-w-0">
										<div className="truncate text-sm font-medium text-stone-700">{preset.name}</div>
										<div className="text-xs text-stone-400">
											{preset.focusMinutes}/{preset.shortBreakMinutes}/{preset.longBreakMinutes} min · {preset.sessionsBeforeLongBreak}{' '}
											sessions
										</div>
									</div>
									<div className="flex shrink-0 items-center gap-1">
										<button
											onClick={() => handleRunClick(preset.id)}
											className="flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
										>
											<Play size={12} fill="currentColor" /> Start
										</button>
										<button
											onClick={() => startEdit(preset)}
											className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
										>
											<Pencil size={14} />
										</button>
										<button
											onClick={() => handleDeleteClick(preset)}
											className="rounded-full p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500"
										>
											<Trash2 size={14} />
										</button>
									</div>
								</>
							)}
						</div>
					)
				)}
			</div>
		</div>
	);
}
