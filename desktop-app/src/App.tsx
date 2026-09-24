import { useEffect, useState } from 'react';
import { ANIM_MODE_MAP } from './constants';
import { useSerial } from './hooks/useSerial';
import { PomodoroProvider } from './context/PomodoroContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { DashboardPage } from './components/DashboardPage';
import { Sidebar } from './components/Sidebar';
import { ScanningScreen } from './components/ScanningScreen';
import { SuccessScreen } from './components/SuccessScreen';
import { WelcomeScreen } from './components/WelcomeScreen';
import { PomodoroPage } from './components/PomodoroPage';
import { DevicePage } from './components/DevicePage';
import type { Page, Screen } from './types';

export default function App() {
	const [currentMode, setCurrentMode] = useState('IDLE');
	const { status, connectedPath, deviceLog, setDeviceLog, logEndRef, sendPacket } = useSerial();

	// Shared by manual Dashboard buttons and the Pomodoro timer's device
	// animations, so the Dashboard's "current mode" badge stays accurate
	// regardless of which page triggered the change.
	function sendAnimPacket(packet: string) {
		sendPacket(packet);
		const m = ANIM_MODE_MAP[packet.trim()];
		if (m) setCurrentMode(m);
	}

	useEffect(() => {
		window.api.onModeChange(setCurrentMode);
	}, []);

	return (
		<ConfirmProvider>
			<PomodoroProvider sendPacket={sendAnimPacket}>
				<AppShell
					status={status}
					connectedPath={connectedPath}
					deviceLog={deviceLog}
					setDeviceLog={setDeviceLog}
					logEndRef={logEndRef}
					sendPacket={sendPacket}
					currentMode={currentMode}
					setCurrentMode={setCurrentMode}
				/>
			</PomodoroProvider>
		</ConfirmProvider>
	);
}

interface AppShellProps {
	status: string;
	connectedPath: string;
	deviceLog: string[];
	setDeviceLog: (log: string[]) => void;
	logEndRef: React.RefObject<HTMLDivElement>;
	sendPacket: (packet: string) => void;
	currentMode: string;
	setCurrentMode: (mode: string) => void;
}

function AppShell({ status, connectedPath, deviceLog, setDeviceLog, logEndRef, sendPacket, currentMode, setCurrentMode }: AppShellProps) {
	const [screen, setScreen] = useState<Screen>(() =>
		localStorage.getItem('gb_connected') ? 'dashboard' : 'scanning',
	);
	const [activePage, setActivePage] = useState<Page>('dashboard');

	useEffect(() => {
		if (status !== 'connected') return;
		if (!localStorage.getItem('gb_connected')) {
			localStorage.setItem('gb_connected', '1');
			setScreen('success');
			setTimeout(() => {
				setScreen(localStorage.getItem('gb_wifi_prompted') ? 'dashboard' : 'welcome');
			}, 2500);
		}
	}, [status]);

	const connected = status === 'connected';

	if (screen === 'scanning') return <ScanningScreen />;
	if (screen === 'success') return <SuccessScreen path={connectedPath} />;
	if (screen === 'welcome') {
		return (
			<WelcomeScreen
				onDone={() => {
					localStorage.setItem('gb_wifi_prompted', '1');
					setScreen('dashboard');
				}}
			/>
		);
	}

	return (
		<div className="flex h-screen flex-col bg-stone-50 text-stone-800">
			<div className="flex min-h-0 flex-1">
				<Sidebar
					activePage={activePage}
					onPageChange={setActivePage}
					connected={connected}
					connectedPath={connectedPath}
				/>
				<main className="flex-1 overflow-hidden">
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
						/>
					)}
					{activePage === 'device' && (
						<DevicePage
							connected={connected}
							onReset={() => {
								sendPacket('#R\n');
								setCurrentMode('IDLE');
							}}
						/>
					)}
					{activePage === 'pomodoro' && <PomodoroPage />}
				</main>
			</div>
		</div>
	);
}
