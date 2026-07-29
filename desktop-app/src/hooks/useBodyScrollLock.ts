import { useEffect } from 'react';

// Prevents the page behind a full-screen mobile overlay (sidebar drawer, task/event
// panel) from scrolling via touch while the overlay is open.
export function useBodyScrollLock(active: boolean) {
	useEffect(() => {
		if (!active) return;
		const original = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = original;
		};
	}, [active]);
}
