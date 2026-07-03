import { useEffect, useState } from 'react';

export function AnimatedDots() {
	const [dots, setDots] = useState('');
	useEffect(() => {
		const timer = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 500);
		return () => clearInterval(timer);
	}, []);
	return <span>{dots}</span>;
}
