import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface Entity {
	id: string;
	createdAt: number;
	updatedAt: number;
}

export function createJsonStore<T extends Entity>(filename: string) {
	const filePath = join(app.getPath('userData'), filename);

	function readAll(): T[] {
		if (!existsSync(filePath)) return [];
		try {
			return JSON.parse(readFileSync(filePath, 'utf8')) as T[];
		} catch (err) {
			console.error(`[store] failed to parse ${filename}:`, (err as Error).message);
			return [];
		}
	}

	function writeAll(items: T[]) {
		writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');
	}

	return {
		list(): T[] {
			return readAll();
		},
		// Caller supplies `id` (the renderer generates it client-side, e.g. via
		// crypto.randomUUID(), so the ported task-store hooks — which build a
		// full new item and hand it to React state before persistence catches
		// up — never have to reconcile a server-assigned id back into local
		// state). Upserts by id, though in practice this is only ever called
		// for ids that don't exist yet.
		create(data: Omit<T, 'createdAt' | 'updatedAt'>): T {
			const now = Date.now();
			const item = { ...data, createdAt: now, updatedAt: now } as T;
			const items = readAll();
			const index = items.findIndex((existing) => existing.id === item.id);
			if (index === -1) items.push(item);
			else items[index] = item;
			writeAll(items);
			return item;
		},
		update(id: string, patch: Partial<Omit<T, 'id' | 'createdAt'>>): T | null {
			const items = readAll();
			const index = items.findIndex((item) => item.id === id);
			if (index === -1) return null;
			const updated = { ...items[index], ...patch, updatedAt: Date.now() } as T;
			items[index] = updated;
			writeAll(items);
			return updated;
		},
		remove(id: string): void {
			writeAll(readAll().filter((item) => item.id !== id));
		},
	};
}

// For singleton values (settings/stats) that don't fit the entity-array shape
// above — one JSON file holding one object, no id/createdAt/updatedAt.
export function createJsonValueStore<T>(filename: string, defaultValue: T) {
	const filePath = join(app.getPath('userData'), filename);

	return {
		get(): T {
			if (!existsSync(filePath)) return defaultValue;
			try {
				return JSON.parse(readFileSync(filePath, 'utf8')) as T;
			} catch (err) {
				console.error(`[store] failed to parse ${filename}:`, (err as Error).message);
				return defaultValue;
			}
		},
		set(value: T): void {
			writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
		},
	};
}
