import { useEffect, useState } from 'react';
import { ANIM_MODE_MAP } from './constants';
import { useSerial } from './hooks/useSerial';
import { DashboardPage } from './components/DashboardPage';
import { Sidebar } from './components/Sidebar';
import { ScanningScreen } from './components/ScanningScreen';
import { SuccessScreen } from './components/SuccessScreen';
import { PomodoroPage } from './PomodoroPage';
import type { Page, Screen } from './types';

export default function App() {
	const [screen, setScreen] = useState<Screen>(() =>
		localStorage.getItem('gb_connected') ? 'dashboard' : 'scanning',
	);
	const [activePage, setActivePage] = useState<Page>('dashboard');
	const [currentMode, setCurrentMode] = useState('IDLE');

	const { status, connectedPath, deviceLog, setDeviceLog, logEndRef, sendPacket } = useSerial();

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

	return (
		<div style={{ display: 'flex', height: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif' }}>
			<Sidebar
				activePage={activePage}
				onPageChange={setActivePage}
				connected={connected}
				connectedPath={connectedPath}
			/>
			<main style={{ flexGrow: 1, padding: '40px', display: 'flex', flexDirection: 'column', gap: '25px', overflow: 'auto' }}>
				{activePage === 'pomodoro' && (
					<PomodoroPage
						connected={connected}
						onCommand={(packet) => {
							sendPacket(packet);
							const m = ANIM_MODE_MAP[packet.trim()];
							if (m) setCurrentMode(m);
						}}
					/>
				)}
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
			</main>
		</div>
	);
}
