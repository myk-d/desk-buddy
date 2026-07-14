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
import { DevicePage } from './components/DevicePage';
import { colors } from './theme';
import type { Page, PomodoroPreset, Screen } from './types';

export default function App() {
	const [screen, setScreen] = useState<Screen>(() =>
		localStorage.getItem('gb_connected') ? 'dashboard' : 'scanning',
	);
	const [activePage, setActivePage] = useState<Page>('dashboard');
	const [currentMode, setCurrentMode] = useState('IDLE');
	const [pomodoroView, setPomodoroView] = useState<'list' | 'run'>('list');
	const [updateReady, setUpdateReady] = useState(false);

	const { status, connectedPath, deviceLog, setDeviceLog, logEndRef, sendPacket } = useSerial();

	function sendAnimPacket(packet: string) {
		sendPacket(packet);
		const m = ANIM_MODE_MAP[packet.trim()];
		if (m) setCurrentMode(m);
	}

	const runner = usePomodoroRunner(sendAnimPacket);

	useEffect(() => {
		window.api.onModeChange(setCurrentMode);
		window.api.onUpdateReady(() => setUpdateReady(true));
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
		<div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
		{updateReady && (
			<div style={{
				display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
				padding: '10px 20px', backgroundColor: '#1e3a5f', borderBottom: '1px solid #2563eb',
				fontSize: '13px', color: '#93c5fd', flexShrink: 0,
			}}>
				<span>A new version has been downloaded and is ready to install.</span>
				<button
					onClick={() => window.api.installUpdate()}
					style={{
						padding: '5px 16px', borderRadius: '6px', border: 'none',
						backgroundColor: '#2563eb', color: '#fff',
						fontSize: '13px', fontWeight: '600', cursor: 'pointer',
					}}
				>
					Restart to update
				</button>
			</div>
		)}
		<div className="gb-shell" style={{ backgroundColor: colors.bg, color: colors.textPrimary, fontFamily: 'sans-serif', flex: 1, minHeight: 0 }}>
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
				{activePage === 'device' && <DevicePage connected={connected} />}
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
		</div>
	);
}
