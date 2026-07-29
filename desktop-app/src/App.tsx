import { useEffect, useState } from 'react';
import { ANIM_MODE_MAP } from './constants';
import { useSerial } from './hooks/useSerial';
import { TaskStoreProvider, useTaskStoreContext } from './context/TaskStoreContext';
import { EventStoreProvider, useEventStoreContext } from './context/EventStoreContext';
import { PomodoroProvider } from './context/PomodoroContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { useNotificationReminders } from './hooks/useNotificationReminders';
import { DashboardPage } from './components/DashboardPage';
import { Sidebar } from './components/Sidebar';
import { ScanningScreen } from './components/ScanningScreen';
import { SuccessScreen } from './components/SuccessScreen';
import { WelcomeScreen } from './components/WelcomeScreen';
import { TasksPage } from './components/TasksPage';
import { CalendarPage } from './components/CalendarPage';
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
			<TaskStoreProvider>
				<EventStoreProvider>
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
				</EventStoreProvider>
			</TaskStoreProvider>
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
	const [updateReady, setUpdateReady] = useState(false);

	const { tasks } = useTaskStoreContext();
	const { events } = useEventStoreContext();
	useNotificationReminders(tasks, events);

	useEffect(() => {
		window.api.onUpdateReady(() => setUpdateReady(true));
	}, []);

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
			{updateReady && (
				<div className="flex shrink-0 items-center justify-center gap-4 border-b border-blue-700 bg-blue-900 px-5 py-2.5 text-sm text-blue-200">
					<span>A new version has been downloaded and is ready to install.</span>
					<button
						onClick={() => window.api.installUpdate()}
						className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-500"
					>
						Restart to update
					</button>
				</div>
			)}
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
							onReset={() => {
								sendPacket('#R\n');
								setCurrentMode('IDLE');
							}}
						/>
					)}
					{activePage === 'tasks' && <TasksPage />}
					{activePage === 'calendar' && <CalendarPage />}
					{activePage === 'device' && <DevicePage connected={connected} />}
					{activePage === 'pomodoro' && <PomodoroPage />}
				</main>
			</div>
		</div>
	);
}
