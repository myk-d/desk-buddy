import { createContext, useContext, type ReactNode } from 'react';
import { useTaskStore, type TaskStore } from '../hooks/useTaskStore';

const TaskStoreContext = createContext<TaskStore | null>(null);

export function TaskStoreProvider({ children }: { children: ReactNode }) {
	const store = useTaskStore();
	return <TaskStoreContext.Provider value={store}>{children}</TaskStoreContext.Provider>;
}

export function useTaskStoreContext(): TaskStore {
	const ctx = useContext(TaskStoreContext);
	if (!ctx) throw new Error('useTaskStoreContext must be used within a TaskStoreProvider');
	return ctx;
}
