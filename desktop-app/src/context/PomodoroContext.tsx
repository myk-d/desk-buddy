import { createContext, useContext, type ReactNode } from 'react';
import { usePomodoro, type Pomodoro } from '../hooks/usePomodoro';

const PomodoroContext = createContext<Pomodoro | null>(null);

export function PomodoroProvider({ children, sendPacket }: { children: ReactNode; sendPacket: (packet: string) => void }) {
	const pomodoro = usePomodoro(sendPacket);
	return <PomodoroContext.Provider value={pomodoro}>{children}</PomodoroContext.Provider>;
}

export function usePomodoroContext(): Pomodoro {
	const ctx = useContext(PomodoroContext);
	if (!ctx) throw new Error('usePomodoroContext must be used within PomodoroProvider');
	return ctx;
}
