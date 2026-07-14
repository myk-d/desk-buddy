import { Page } from '../types';
import { colors } from '../theme';

const NAV_ITEMS: [Page, string][] = [
	['dashboard', 'Dashboard'],
	['todo', 'Todo'],
	['pomodoro', 'Pomodoro'],
	['device', 'Device'],
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
			className="gb-sidebar"
			style={{
				backgroundColor: colors.surface,
				padding: '25px',
				gap: '20px',
				borderRight: `1px solid ${colors.border}`,
			}}
		>
			<div style={{ fontSize: '22px', fontWeight: 'bold', color: colors.accent, letterSpacing: '0.5px' }}>
				GAZE BUDDY
			</div>
			<div style={{ fontSize: '12px', color: colors.textMuted, textTransform: 'uppercase', fontWeight: 'bold' }}>
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
							backgroundColor: activePage === id ? colors.bg : 'transparent',
							color: activePage === id ? colors.textPrimary : colors.textFaint,
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
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					gap: '8px',
					padding: '12px',
					borderRadius: '8px',
					fontWeight: 'bold',
					fontSize: '14px',
					backgroundColor: connected ? '#065f46' : '#1c1917',
					color: connected ? colors.successBright : '#78716c',
					border: `1px solid ${connected ? '#166534' : '#292524'}`,
					transition: 'all 0.3s ease',
				}}
			>
				<span
					style={{
						width: '8px',
						height: '8px',
						borderRadius: '50%',
						backgroundColor: connected ? colors.successBright : '#78716c',
					}}
				/>
				{connected ? 'DEVICE ONLINE' : 'CONNECTING...'}
			</div>

			{import.meta.env.DEV && connectedPath && (
				<div
					style={{
						fontSize: '11px',
						color: colors.textDisabled,
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
