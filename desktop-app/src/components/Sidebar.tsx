import { Page } from '../types';

const NAV_ITEMS: [Page, string][] = [
	['dashboard', '📊 Dashboard'],
	['pomodoro', '⏱ Pomodoro'],
];

interface Props {
	activePage: Page;
	onPageChange: (page: Page) => void;
	connected: boolean;
	connectedPath: string;
}

export function Sidebar({ activePage, onPageChange, connected, connectedPath }: Props) {
	return (
		<aside
			style={{
				width: '250px',
				backgroundColor: '#1e293b',
				padding: '25px',
				display: 'flex',
				flexDirection: 'column',
				gap: '20px',
				borderRight: '1px solid #334155',
				flexShrink: 0,
			}}
		>
			<div style={{ fontSize: '22px', fontWeight: 'bold', color: '#38bdf8', letterSpacing: '0.5px' }}>
				👁️ GAZE BUDDY
			</div>
			<div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>
				Control Console
			</div>

			<nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
				{NAV_ITEMS.map(([id, label]) => (
					<button
						key={id}
						onClick={() => onPageChange(id)}
						style={{
							padding: '9px 12px',
							borderRadius: '7px',
							border: 'none',
							backgroundColor: activePage === id ? '#0f172a' : 'transparent',
							color: activePage === id ? '#f8fafc' : '#64748b',
							fontSize: '13px',
							fontWeight: activePage === id ? '600' : '400',
							textAlign: 'left',
							cursor: 'pointer',
							transition: 'background-color 0.15s, color 0.15s',
						}}
					>
						{label}
					</button>
				))}
			</nav>

			<div style={{ flexGrow: 1 }} />

			<div
				style={{
					padding: '12px',
					borderRadius: '8px',
					textAlign: 'center',
					fontWeight: 'bold',
					fontSize: '14px',
					backgroundColor: connected ? '#065f46' : '#1c1917',
					color: connected ? '#4ade80' : '#78716c',
					border: `1px solid ${connected ? '#166534' : '#292524'}`,
					transition: 'all 0.3s ease',
				}}
			>
				{connected ? '🟢 DEVICE ONLINE' : '⏳ CONNECTING...'}
			</div>

			{connectedPath && (
				<div
					style={{
						fontSize: '11px',
						color: '#475569',
						fontFamily: 'monospace',
						textAlign: 'center',
						wordBreak: 'break-all',
					}}
				>
					{connectedPath}
				</div>
			)}
		</aside>
	);
}
