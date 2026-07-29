import { RefObject } from 'react';
import { COMMANDS } from '../constants';

interface Props {
	connected: boolean;
	currentMode: string;
	deviceLog: string[];
	logEndRef: RefObject<HTMLDivElement>;
	onCommand: (packet: string, mode: string) => void;
	onClearLog: () => void;
	onReset: () => void;
}

export function DashboardPage({ connected, currentMode, deviceLog, logEndRef, onCommand, onClearLog, onReset }: Props) {
	return (
		<div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto px-8 py-8">
			<div>
				<h1 className="text-2xl font-black tracking-tight text-stone-900">State Monitor</h1>
				<p className="mt-1 text-sm text-stone-500">Emotion emulation control panel</p>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
				<div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-stone-200 bg-white px-5 py-8">
					<span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Active Mode</span>
					<span className="text-4xl font-bold text-brand-600">{currentMode}</span>
				</div>

				<div className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6">
					<span className="text-lg font-bold text-stone-900">Emotion Emulation (Remote)</span>
					<div className="grid grid-cols-2 gap-3">
						{COMMANDS.map(({ label, packet, mode, bg }) => (
							<button
								key={mode}
								disabled={!connected}
								onClick={() => onCommand(packet, mode)}
								className={`rounded-lg p-3.5 text-sm font-semibold transition disabled:cursor-not-allowed ${
									connected ? 'cursor-pointer text-white' : 'bg-stone-100 text-stone-400'
								}`}
								style={connected ? { backgroundColor: bg } : undefined}
								onMouseEnter={(e) => connected && ((e.target as HTMLButtonElement).style.filter = 'brightness(1.2)')}
								onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.filter = 'brightness(1)')}
							>
								{label}
							</button>
						))}
					</div>
					<button
						disabled={!connected}
						onClick={onReset}
						className={`rounded-lg border p-2.5 text-[13px] font-semibold transition disabled:cursor-not-allowed ${
							connected
								? 'cursor-pointer border-red-200 bg-red-50 text-red-600'
								: 'border-stone-200 bg-transparent text-stone-300'
						}`}
						onMouseEnter={(e) => connected && ((e.target as HTMLButtonElement).style.filter = 'brightness(1.3)')}
						onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.filter = 'brightness(1)')}
					>
						RESET DEVICE
					</button>
				</div>
			</div>

			{import.meta.env.DEV && (
				<div className="flex min-h-[180px] flex-1 flex-col gap-2.5 overflow-hidden rounded-2xl border border-stone-200 bg-white p-5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Device Log</span>
						{deviceLog.length > 0 && (
							<button
								onClick={onClearLog}
								className="cursor-pointer rounded border-none bg-transparent px-1.5 py-0.5 text-xs text-stone-400 hover:text-stone-600"
							>
								Clear
							</button>
						)}
					</div>
					<div ref={logEndRef} className="flex-1 overflow-y-auto rounded-xl bg-stone-900 p-3 font-mono text-xs leading-relaxed text-stone-300">
						{deviceLog.length === 0 ? (
							<span className="text-stone-600">No data received yet...</span>
						) : (
							deviceLog.map((line, i) => {
								const isSent = line.startsWith('→');
								const isMeta = line.startsWith('──');
								return (
									<div
										key={i}
										className={
											isSent ? 'text-brand-400' : isMeta ? 'italic text-stone-500' : 'text-stone-300'
										}
									>
										{!isSent && !isMeta && <span className="select-none text-stone-600">&gt; </span>}
										{line}
									</div>
								);
							})
						)}
					</div>
				</div>
			)}
		</div>
	);
}
