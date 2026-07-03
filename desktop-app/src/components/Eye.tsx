import { colors } from '../theme';

export function Eye({ color = colors.accent, pupilOffset = 0 }: { color?: string; pupilOffset?: number }) {
	return (
		<div
			style={{
				width: '60px',
				height: '60px',
				backgroundColor: color,
				borderRadius: '50%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				transition: 'background-color 0.6s ease',
				boxShadow: `0 0 24px ${color}88`,
			}}
		>
			<div
				style={{
					width: '22px',
					height: '22px',
					backgroundColor: colors.bg,
					borderRadius: '50%',
					transform: `translateX(${pupilOffset}px)`,
					transition: 'transform 0.35s ease',
				}}
			/>
		</div>
	);
}
