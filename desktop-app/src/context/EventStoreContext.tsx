import { createContext, useContext, type ReactNode } from 'react';
import { useEventStore, type EventStore } from '../hooks/useEventStore';

const EventStoreContext = createContext<EventStore | null>(null);

export function EventStoreProvider({ children }: { children: ReactNode }) {
	const store = useEventStore();
	return <EventStoreContext.Provider value={store}>{children}</EventStoreContext.Provider>;
}

export function useEventStoreContext(): EventStore {
	const ctx = useContext(EventStoreContext);
	if (!ctx) throw new Error('useEventStoreContext must be used within EventStoreProvider');
	return ctx;
}
