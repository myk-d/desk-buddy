import { useEffect, useState } from 'react';

interface ValueStoreApi<T> {
	get: () => Promise<T>;
	set: (value: T) => Promise<void>;
}

// Drop-in replacement shape for msln-focus's useFirestoreValue: a single
// value hydrated once via IPC `get()`, then persisted whole via `set()` on
// every change after hydration.
export function useRemoteValue<T>(api: ValueStoreApi<T>, initialValue: T) {
	const [value, setValue] = useState<T>(initialValue);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const stored = await api.get();
			if (cancelled) return;
			setValue(stored);
			setHydrated(true);
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		void api.set(value);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value, hydrated]);

	return [value, setValue] as const;
}
