import { useEffect, useState } from 'react';
import type { PomodoroPreset } from '../types';

export function usePomodoros() {
	const [presets, setPresets] = useState<PomodoroPreset[]>([]);

	useEffect(() => {
		window.api.pomodoros.list().then(setPresets);
	}, []);

	async function add(data: Omit<PomodoroPreset, 'id' | 'createdAt' | 'updatedAt'>) {
		const created = await window.api.pomodoros.create(data);
		setPresets((prev) => [...prev, created]);
	}

	async function edit(id: string, patch: Partial<Omit<PomodoroPreset, 'id' | 'createdAt'>>) {
		const updated = await window.api.pomodoros.update(id, patch);
		if (updated) setPresets((prev) => prev.map((p) => (p.id === id ? updated : p)));
	}

	async function remove(id: string) {
		await window.api.pomodoros.remove(id);
		setPresets((prev) => prev.filter((p) => p.id !== id));
	}

	return { presets, add, edit, remove };
}
