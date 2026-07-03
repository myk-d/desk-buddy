import { useEffect, useState } from 'react';
import { AnimatedDots } from './AnimatedDots';
import { Eye } from './Eye';

export function ScanningScreen() {
	const [pupilOffset, setPupilOffset] = useState(0);

	useEffect(() => {
		const sequence = [0, 6, 0, -6];
		let phase = 0;
		const timer = setInterval(() => {
			phase = (phase + 1) % sequence.length;
			setPupilOffset(sequence[phase]);
		}, 700);
		return () => clearInterval(timer);
	}, []);

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
			}}
		>
			<div
				style={{
					position: 'relative',
					width: '220px',
					height: '220px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				{[0, 0.7, 1.4].map((delay) => (
					<div
						key={delay}
						style={{
							position: 'absolute',
							width: '150px',
							height: '150px',
							borderRadius: '50%',
							border: '2px solid #38bdf8',
							animation: 'gb-pulse-ring 2.1s ease-out infinite',
							animationDelay: `${delay}s`,
						}}
					/>
				))}
				<div style={{ display: 'flex', gap: '20px', zIndex: 1 }}>
					<Eye pupilOffset={pupilOffset} />
					<Eye pupilOffset={pupilOffset} />
				</div>
			</div>

			<div style={{ textAlign: 'center', animation: 'gb-fade-in 0.5s ease' }}>
				<div style={{ fontSize: '26px', fontWeight: 'bold', marginBottom: '10px' }}>Searching for Gaze Buddy</div>
				<div style={{ color: '#475569', fontSize: '15px', marginBottom: '8px' }}>
					Scanning USB ports
					<AnimatedDots />
				</div>
				<div style={{ color: '#334155', fontSize: '13px' }}>Scanning can take up to 15 seconds</div>
			</div>
		</div>
	);
}
