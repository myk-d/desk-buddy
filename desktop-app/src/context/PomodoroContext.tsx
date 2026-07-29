import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePomodoro, type Pomodoro } from '../hooks/usePomodoro';

const PomodoroContext = createContext<Pomodoro | null>(null);
const PomodoroActionsContext = createContext<{ startForTask: (taskId: string) => void } | null>(null);

// Split into two contexts so components that only need `startForTask` (every
// TaskRow, TaskDetailPanel) don't re-render on every second the timer ticks —
// `PomodoroActionsContext` holds only a `useMemo`-stabilized `startForTask`,
// which stays referentially stable because `usePomodoro`'s `startForTask`
// itself is a stable `useCallback`.
export function PomodoroProvider({ children, sendPacket }: { children: ReactNode; sendPacket: (packet: string) => void }) {
	const pomodoro = usePomodoro(sendPacket);
	const actions = useMemo(() => ({ startForTask: pomodoro.startForTask }), [pomodoro.startForTask]);
	return (
		<PomodoroContext.Provider value={pomodoro}>
			<PomodoroActionsContext.Provider value={actions}>{children}</PomodoroActionsContext.Provider>
		</PomodoroContext.Provider>
	);
}

export function usePomodoroContext(): Pomodoro {
	const ctx = useContext(PomodoroContext);
	if (!ctx) throw new Error('usePomodoroContext must be used within PomodoroProvider');
	return ctx;
}

export function usePomodoroActions(): { startForTask: (taskId: string) => void } {
	const ctx = useContext(PomodoroActionsContext);
	if (!ctx) throw new Error('usePomodoroActions must be used within PomodoroProvider');
	return ctx;
}
