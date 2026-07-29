import { useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import type { CalendarEvent, Task } from '../types';

const NOTIFIED_KEY = 'gaze-buddy-notified-reminders';
const CHECK_INTERVAL_MS = 20_000;
const FIRE_WINDOW_MINUTES = 5;
// Tasks only carry a due *date*, not a time, so a fixed daily anchor stands in
// for "due time" — matches the 09:00 default already used for new events.
const TASK_DUE_TIME = '09:00';
const TASK_REMINDER_MINUTES = 15;

function loadNotified(): Set<string> {
	try {
		const raw = localStorage.getItem(NOTIFIED_KEY);
		return raw ? new Set(JSON.parse(raw)) : new Set();
	} catch {
		return new Set();
	}
}

function saveNotified(ids: Set<string>) {
	localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids]));
}

// Android Chrome throws on `new Notification()` from page code — it requires
// showing notifications through a service worker registration instead.
// Electron's renderer supports `new Notification()` directly, so preferring
// the SW path (only relevant on the web) falls straight through here.
async function fireNotification(title: string, body: string, tag: string) {
	const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
	if (registration) {
		registration.showNotification(title, { body, tag });
	} else {
		new Notification(title, { body, tag });
	}
}

function isDueNow(triggerAt: dayjs.Dayjs, now: dayjs.Dayjs): boolean {
	return !now.isBefore(triggerAt) && now.diff(triggerAt, 'minute') < FIRE_WINDOW_MINUTES;
}

// Runs while the app is open only — there is no backend to deliver push
// notifications when the app is closed.
export function useNotificationReminders(tasks: Task[], events: CalendarEvent[]) {
	const notifiedRef = useRef<Set<string> | null>(null);
	if (notifiedRef.current === null) notifiedRef.current = loadNotified();

	useEffect(() => {
		if (typeof Notification === 'undefined') return;

		const check = async () => {
			if (Notification.permission !== 'granted') return;
			const notified = notifiedRef.current!;
			const now = dayjs();
			let changed = false;

			for (const task of tasks) {
				if (task.completed || !task.dueDate) continue;
				const key = `task:${task.id}:${task.dueDate}`;
				if (notified.has(key)) continue;
				const triggerAt = dayjs(`${task.dueDate} ${TASK_DUE_TIME}`).subtract(TASK_REMINDER_MINUTES, 'minute');
				if (isDueNow(triggerAt, now)) {
					await fireNotification('Task due soon', task.text, key);
					notified.add(key);
					changed = true;
				}
			}

			for (const event of events) {
				if (event.reminderMinutes == null) continue;
				const key = `event:${event.id}:${event.date}:${event.startTime}:${event.reminderMinutes}`;
				if (notified.has(key)) continue;
				const anchorTime = event.allDay ? TASK_DUE_TIME : event.startTime;
				const triggerAt = dayjs(`${event.date} ${anchorTime}`).subtract(event.reminderMinutes, 'minute');
				if (isDueNow(triggerAt, now)) {
					await fireNotification('Event starting soon', event.title, key);
					notified.add(key);
					changed = true;
				}
			}

			if (changed) saveNotified(notified);
		};

		void check();
		const id = setInterval(() => void check(), CHECK_INTERVAL_MS);
		return () => clearInterval(id);
	}, [tasks, events]);
}
