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
		<>
			<div>
				<h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>State Monitor</h1>
				<p style={{ color: '#94a3b8', marginTop: '6px', marginBottom: 0, fontSize: '16px' }}>
					Emotion emulation control panel
				</p>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px' }}>
				<div
					style={{
						padding: '30px 20px',
						backgroundColor: '#1e293b',
						borderRadius: '12px',
						border: '1px solid #334155',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '10px',
					}}
				>
					<span style={{ fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>
						Active Mode
					</span>
					<span style={{ fontSize: '42px', fontWeight: 'bold', color: '#38bdf8' }}>{currentMode}</span>
				</div>

				<div
					style={{
						padding: '25px',
						backgroundColor: '#1e293b',
						borderRadius: '12px',
						border: '1px solid #334155',
						display: 'flex',
						flexDirection: 'column',
						gap: '16px',
					}}
				>
					<span style={{ fontSize: '18px', fontWeight: 'bold' }}>Emotion Emulation (Remote)</span>
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
						{COMMANDS.map(({ label, packet, mode, bg }) => (
							<button
								key={mode}
								disabled={!connected}
								onClick={() => onCommand(packet, mode)}
								style={{
									padding: '14px',
									borderRadius: '8px',
									border: 'none',
									cursor: connected ? 'pointer' : 'not-allowed',
									backgroundColor: connected ? bg : '#1e293b',
									color: connected ? '#fff' : '#475569',
									fontSize: '14px',
									fontWeight: '600',
									transition: 'filter 0.15s',
								}}
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
						style={{
							padding: '10px',
							borderRadius: '8px',
							border: `1px solid ${connected ? '#7c2d12' : '#292524'}`,
							cursor: connected ? 'pointer' : 'not-allowed',
							backgroundColor: connected ? '#1c0a00' : 'transparent',
							color: connected ? '#fb923c' : '#475569',
							fontSize: '13px',
							fontWeight: '600',
							transition: 'filter 0.15s',
						}}
						onMouseEnter={(e) => connected && ((e.target as HTMLButtonElement).style.filter = 'brightness(1.3)')}
						onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.filter = 'brightness(1)')}
					>
						🔄 RESET DEVICE
					</button>
				</div>
			</div>

			<div
				style={{
					backgroundColor: '#1e293b',
					borderRadius: '12px',
					border: '1px solid #334155',
					padding: '20px',
					display: 'flex',
					flexDirection: 'column',
					gap: '10px',
					flexGrow: 1,
					minHeight: '180px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<span
						style={{
							fontSize: '14px',
							color: '#94a3b8',
							textTransform: 'uppercase',
							fontWeight: 'bold',
							letterSpacing: '0.5px',
						}}
					>
						Device Log
					</span>
					{deviceLog.length > 0 && (
						<button
							onClick={onClearLog}
							style={{
								background: 'none',
								border: 'none',
								color: '#475569',
								cursor: 'pointer',
								fontSize: '12px',
								padding: '2px 6px',
							}}
						>
							Clear
						</button>
					)}
				</div>
				<div
					style={{
						flexGrow: 1,
						overflowY: 'auto',
						fontFamily: 'monospace',
						fontSize: '12px',
						color: '#94a3b8',
						lineHeight: '1.7',
					}}
				>
					{deviceLog.length === 0 ? (
						<span style={{ color: '#334155' }}>No data received yet...</span>
					) : (
						deviceLog.map((line, i) => {
							const isSent = line.startsWith('→');
							const isMeta = line.startsWith('──');
							return (
								<div
									key={i}
									style={{
										color: isSent ? '#38bdf8' : isMeta ? '#475569' : '#94a3b8',
										fontStyle: isMeta ? 'italic' : 'normal',
									}}
								>
									{!isSent && !isMeta && <span style={{ color: '#334155', userSelect: 'none' }}>&gt; </span>}
									{line}
								</div>
							);
						})
					)}
					<div ref={logEndRef} />
				</div>
			</div>
		</>
	);
}
