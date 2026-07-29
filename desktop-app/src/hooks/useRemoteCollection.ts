import { useEffect, useRef, useState } from 'react';

interface CollectionApi<T extends { id: string }> {
	list: () => Promise<T[]>;
	create: (data: T) => Promise<T>;
	update: (id: string, patch: Partial<T>) => Promise<T | null>;
	remove: (id: string) => Promise<void>;
}

// Drop-in replacement shape for msln-focus's useFirestoreCollection: callers
// read/update the array exactly like normal React state via the returned
// `[value, setValue]`, unaware persistence happens against a local JSON file
// (via IPC) behind the scenes. `setValue` diffs the new array against the
// last-synced snapshot and fires create/update/remove for whatever changed —
// same algorithm as the source hook, just without Firestore/uid scoping.
export function useRemoteCollection<T extends { id: string }>(api: CollectionApi<T>, initialValue: T[] = []) {
	const [value, setValue] = useState<T[]>(initialValue);
	const [hydrated, setHydrated] = useState(false);
	const lastSyncedRef = useRef<T[]>([]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const items = await api.list();
			if (cancelled) return;
			lastSyncedRef.current = items;
			setValue(items);
			setHydrated(true);
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Gated on `hydrated` so this can never fire (and overwrite real stored data
	// with the seed) before the initial list() above has had a chance to run.
	useEffect(() => {
		if (!hydrated) return;
		const prev = lastSyncedRef.current;
		const prevById = new Map(prev.map((p) => [p.id, p]));
		const nextIds = new Set(value.map((v) => v.id));

		for (const item of value) {
			const prevItem = prevById.get(item.id);
			if (!prevItem) {
				void api.create(item);
			} else if (JSON.stringify(prevItem) !== JSON.stringify(item)) {
				void api.update(item.id, item);
			}
		}
		for (const id of prevById.keys()) {
			if (!nextIds.has(id)) void api.remove(id);
		}
		lastSyncedRef.current = value;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value, hydrated]);

	return [value, setValue] as const;
}
