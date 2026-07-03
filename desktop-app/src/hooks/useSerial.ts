import { useEffect, useRef, useState } from 'react';

export function useSerial() {
	const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');
	const [connectedPath, setConnectedPath] = useState('');
	const [deviceLog, setDeviceLog] = useState<string[]>([]);
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
		logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [deviceLog]);

	function sendPacket(packet: string) {
		appendLog([`→ ${packet.trim()}`]);
		window.api.sendPacket(packet);
	}

	return { status, connectedPath, deviceLog, setDeviceLog, logEndRef, sendPacket };
}
