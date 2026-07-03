import { useEffect, useState } from 'react';
import { ANIM_MODE_MAP } from './constants';
import { useSerial } from './hooks/useSerial';
import { usePomodoroRunner } from './hooks/usePomodoroRunner';
import { DashboardPage } from './components/DashboardPage';
import { Sidebar } from './components/Sidebar';
import { ScanningScreen } from './components/ScanningScreen';
import { SuccessScreen } from './components/SuccessScreen';
import { TodoPage } from './components/TodoPage';
import { PomodoroListPage } from './components/PomodoroListPage';
import { PomodoroRunner } from './components/PomodoroRunner';
import { colors } from './theme';
import type { Page, PomodoroPreset, Screen } from './types';

export default function App() {
	const [screen, setScreen] = useState<Screen>(() =>
		localStorage.getItem('gb_connected') ? 'dashboard' : 'scanning',
	);
	const [activePage, setActivePage] = useState<Page>('dashboard');
	const [currentMode, setCurrentMode] = useState('IDLE');
	const [pomodoroView, setPomodoroView] = useState<'list' | 'run'>('list');

	const { status, connectedPath, deviceLog, setDeviceLog, logEndRef, sendPacket } = useSerial();

	function sendAnimPacket(packet: string) {
		sendPacket(packet);
		const m = ANIM_MODE_MAP[packet.trim()];
		if (m) setCurrentMode(m);
	}

	const runner = usePomodoroRunner(sendAnimPacket);

	useEffect(() => {
		window.api.onModeChange(setCurrentMode);
	}, []);

	useEffect(() => {
		if (status !== 'connected') return;
		if (!localStorage.getItem('gb_connected')) {
			localStorage.setItem('gb_connected', '1');
			setScreen('success');
			setTimeout(() => setScreen('dashboard'), 2500);
		}
	}, [status]);

	const connected = status === 'connected';

	if (screen === 'scanning') return <ScanningScreen />;
	if (screen === 'success') return <SuccessScreen path={connectedPath} />;

	function handleStartPreset(preset: PomodoroPreset) {
		runner.start(preset);
		setPomodoroView('run');
	}

	function handleResetRunner() {
		runner.reset();
		setPomodoroView('list');
	}

	return (
		<div className="gb-shell" style={{ backgroundColor: colors.bg, color: colors.textPrimary, fontFamily: 'sans-serif' }}>
			<Sidebar
				activePage={activePage}
				onPageChange={setActivePage}
				connected={connected}
				connectedPath={connectedPath}
			/>
			<main className="gb-main" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
				{activePage === 'dashboard' && (
					<DashboardPage
						connected={connected}
						currentMode={currentMode}
						deviceLog={deviceLog}
						logEndRef={logEndRef}
						onCommand={(packet, mode) => {
							sendPacket(packet);
							setCurrentMode(mode);
						}}
						onClearLog={() => setDeviceLog([])}
						onReset={() => {
							sendPacket('#R\n');
							setCurrentMode('IDLE');
						}}
					/>
				)}
				{activePage === 'todo' && <TodoPage />}
				{activePage === 'pomodoro' && (
					runner.activePreset && pomodoroView === 'run' ? (
						<PomodoroRunner
							preset={runner.activePreset}
							phase={runner.phase}
							running={runner.running}
							secondsLeft={runner.secondsLeft}
							currentSession={runner.currentSession}
							connected={connected}
							onPause={runner.pause}
							onResume={runner.resume}
							onReset={handleResetRunner}
							onBackToList={() => setPomodoroView('list')}
						/>
					) : (
						<PomodoroListPage
							activePresetId={runner.activePreset?.id ?? null}
							onStart={handleStartPreset}
							onOpenRunner={() => setPomodoroView('run')}
						/>
					)
				)}
			</main>
		</div>
	);
}
