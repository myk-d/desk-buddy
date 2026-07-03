import { AnimatedDots } from './AnimatedDots';
import { Eye } from './Eye';

export function SuccessScreen({ path }: { path: string }) {
	return (
		<div
			style={{
				height: '100vh',
				backgroundColor: '#0f172a',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: '48px',
				fontFamily: 'sans-serif',
				color: '#f8fafc',
				animation: 'gb-fade-in 0.4s ease',
			}}
		>
			<div style={{ display: 'flex', gap: '20px' }}>
				<Eye color="#22c55e" />
				<Eye color="#22c55e" />
			</div>

			<div style={{ textAlign: 'center' }}>
				<div style={{ fontSize: '28px', fontWeight: 'bold', color: '#22c55e', marginBottom: '10px' }}>
					Gaze Buddy Connected!
				</div>
				{path && (
					<div style={{ color: '#64748b', fontSize: '13px', fontFamily: 'monospace', marginBottom: '8px' }}>
						{path}
					</div>
				)}
				<div style={{ color: '#334155', fontSize: '13px' }}>
					Opening dashboard
					<AnimatedDots />
				</div>
			</div>
		</div>
	);
}
