import { useEffect, useRef, useState } from 'react';

export function useSerial() {
	const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');
	const [connectedPath, setConnectedPath] = useState('');
	const [deviceLog, setDeviceLog] = useState<string[]>([]);
	// Points at the log's own scrollable box (not a bottom sentinel) so we can
	// set scrollTop directly — scrollIntoView() cascades to scroll ancestor
	// containers too, which at the default window size pushed the whole
	// Dashboard page down far enough to hide its header above the fold.
	const logEndRef = useRef<HTMLDivElement>(null);

	function appendLog(lines: string[]) {
		setDeviceLog((prev) => [...prev, ...lines].slice(-100));
	}

	useEffect(() => {
		window.api.onStatusChange((newStatus, path) => {
			if (newStatus === 'connected') {
				setStatus('connected');
				if (path) setConnectedPath(path);
				appendLog([`── connected on ${path ?? 'unknown'} ──`]);
			} else {
				setStatus('disconnected');
				appendLog(['── device disconnected ──']);
			}
		});

		window.api.onData((data) => {
			const lines = data.split('\n').filter((l) => l.trim().length > 0);
			if (lines.length > 0) appendLog(lines);
		});
	}, []);

	useEffect(() => {
		const el = logEndRef.current;
		if (!el) return;
		// Only snap to bottom if the user was already there — otherwise every
		// new line would yank them back down while reading scrolled-up history.
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (distanceFromBottom < 40) el.scrollTop = el.scrollHeight;
	}, [deviceLog]);

	function sendPacket(packet: string) {
		appendLog([`→ ${packet.trim()}`]);
		window.api.sendPacket(packet);
	}

	return { status, connectedPath, deviceLog, setDeviceLog, logEndRef, sendPacket };
}
