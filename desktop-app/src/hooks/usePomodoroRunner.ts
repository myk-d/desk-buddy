import { useEffect, useRef, useState } from 'react';
import type { PomodoroPreset } from '../types';

export type Phase = 'idle' | 'work' | 'short-break' | 'done';

export function usePomodoroRunner(sendPacket: (packet: string) => void) {
	const [activePreset, setActivePreset] = useState<PomodoroPreset | null>(null);
	const [phase, setPhase] = useState<Phase>('idle');
	const [running, setRunning] = useState(false);
	const [secondsLeft, setSecondsLeft] = useState(0);
	const [currentSession, setCurrentSession] = useState(1);
	const [phaseComplete, setPhaseComplete] = useState(false);

	const phaseRef = useRef(phase);
	const sessionRef = useRef(currentSession);
	const presetRef = useRef(activePreset);
	const sendRef = useRef(sendPacket);

	phaseRef.current = phase;
	sessionRef.current = currentSession;
	presetRef.current = activePreset;
	sendRef.current = sendPacket;

	useEffect(() => {
		if (!running) return;
		const id = setInterval(() => {
			setSecondsLeft((prev) => {
				if (prev <= 1) {
					setPhaseComplete(true);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(id);
	}, [running]);

	useEffect(() => {
		if (!running) return;
		if (phase !== 'work' && phase !== 'short-break') return;
		const preset = presetRef.current;
		if (!preset) return;
		const total = phase === 'work' ? preset.workMin * 60 : preset.breakMin * 60;
		sendRef.current(`#TIME:${secondsLeft}:${total}\n`);
	}, [secondsLeft, running, phase]);

	useEffect(() => {
		if (!phaseComplete) return;
		setPhaseComplete(false);
		const preset = presetRef.current;
		const sess = sessionRef.current;
		const cur = phaseRef.current;
		if (!preset) return;

		if (cur === 'work') {
			if (sess >= preset.sessions) {
				setPhase('done');
				setRunning(false);
				sendRef.current('#ANIM:love\n');
				if (preset.linkedTaskId) {
					window.api.todos.update(preset.linkedTaskId, { completed: true });
				}
			} else {
				setPhase('short-break');
				setSecondsLeft(preset.breakMin * 60);
				sendRef.current('#ANIM:pomobreak\n');
			}
		} else if (cur === 'short-break') {
			const next = sess + 1;
			setCurrentSession(next);
			sessionRef.current = next;
			setPhase('work');
			setSecondsLeft(preset.workMin * 60);
			sendRef.current('#ANIM:pomowork\n');
		}
	}, [phaseComplete]);

	function start(preset: PomodoroPreset) {
		setActivePreset(preset);
		setPhase('work');
		setCurrentSession(1);
		sessionRef.current = 1;
		setSecondsLeft(preset.workMin * 60);
		setRunning(true);
		sendPacket('#ANIM:pomowork\n');
	}

	function pause() {
		setRunning(false);
	}

	function resume() {
		setRunning(true);
	}

	function reset() {
		setRunning(false);
		setPhase('idle');
		setActivePreset(null);
		setCurrentSession(1);
		setSecondsLeft(0);
		sendPacket('#ANIM:idle\n');
	}

	return { activePreset, phase, running, secondsLeft, currentSession, start, pause, resume, reset };
}
