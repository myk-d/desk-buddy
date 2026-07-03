import { app } from 'electron';
import { randomUUID } from 'crypto';
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
		create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): T {
			const now = Date.now();
			const item = { ...data, id: randomUUID(), createdAt: now, updatedAt: now } as T;
			const items = readAll();
			items.push(item);
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
