import { useEffect, useRef } from 'react';

// Grows a textarea to fit its content instead of scrolling internally — used
// for single-line-feeling title fields on mobile, where a fixed-height input
// hides overflow text behind a horizontal scroll the user has to click into.
export function useAutoResizeTextarea(value: string) {
	const ref = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}, [value]);

	return ref;
}
