import { AnimatedDots } from './AnimatedDots';
import { Eye } from './Eye';
import { colors } from '../theme';

export function SuccessScreen({ path }: { path: string }) {
	return (
		<div
			style={{
				height: '100vh',
				backgroundColor: colors.bg,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: '48px',
				fontFamily: 'sans-serif',
				color: colors.textPrimary,
				animation: 'gb-fade-in 0.4s ease',
			}}
		>
			<div style={{ display: 'flex', gap: '20px' }}>
				<Eye color={colors.success} />
				<Eye color={colors.success} />
			</div>

			<div style={{ textAlign: 'center' }}>
				<div style={{ fontSize: '28px', fontWeight: 'bold', color: colors.success, marginBottom: '10px' }}>
					Gaze Buddy Connected!
				</div>
				{path && (
					<div style={{ color: colors.textFaint, fontSize: '13px', fontFamily: 'monospace', marginBottom: '8px' }}>
						{path}
					</div>
				)}
				<div style={{ color: colors.border, fontSize: '13px' }}>
					Opening dashboard
					<AnimatedDots />
				</div>
			</div>
		</div>
	);
}
