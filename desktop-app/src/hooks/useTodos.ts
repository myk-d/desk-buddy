import { useEffect, useState } from 'react';
import type { Todo } from '../types';

export function useTodos() {
	const [todos, setTodos] = useState<Todo[]>([]);

	useEffect(() => {
		window.api.todos.list().then(setTodos);
	}, []);

	async function add(title: string, description?: string) {
		const created = await window.api.todos.create({ title, description, completed: false });
		setTodos((prev) => [...prev, created]);
	}

	async function edit(id: string, patch: Partial<Pick<Todo, 'title' | 'description'>>) {
		const updated = await window.api.todos.update(id, patch);
		if (updated) setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
	}

	async function toggleComplete(id: string) {
		const target = todos.find((t) => t.id === id);
		if (!target) return;
		const updated = await window.api.todos.update(id, { completed: !target.completed });
		if (updated) setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
	}

	async function remove(id: string) {
		await window.api.todos.remove(id);
		setTodos((prev) => prev.filter((t) => t.id !== id));
	}

	return { todos, add, edit, toggleComplete, remove };
}
