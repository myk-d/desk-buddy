import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useClickOutside } from '../../hooks/useClickOutside';
import { HOUR_HEIGHT, SNAP_MINUTES, TAG_COLOR_META, minutesToTime, timeToMinutes } from '../../lib/utils';
import type { CalendarEvent } from '../../types';

interface EventBlockProps {
	event: CalendarEvent;
	overlapIndex: number;
	onSelect: () => void;
	onResize: (patch: { startTime?: string; endTime?: string }) => void;
}

const resizeHandleClass =
	'absolute left-1/2 h-3 w-3 -translate-x-1/2 touch-none cursor-ns-resize rounded-full border-2 border-white bg-stone-700/80 shadow';

// Drag (move) goes through @dnd-kit like the rest of the app's drag-and-drop.
// Resize is a raw pointer listener instead — dnd-kit models drag-to-a-droppable,
// not elastic resize. Each edge handle is a small circular grip (not a full-width
// strip) so it stays a deliberate, precise target that doesn't swallow ordinary
// touch-scroll gestures happening elsewhere on the event, and only renders once
// revealed (hover on desktop, first tap on touch) instead of cluttering every
// event permanently.
export function EventBlock({ event, overlapIndex, onSelect, onResize }: EventBlockProps) {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `event:${event.id}` });
	const [revealed, setRevealed] = useState(false);
	// Explicit `| null` in the generic (rather than relying on the null default
	// arg alone) selects the MutableRefObject overload — needed because setRefs
	// below assigns `.current` manually, unlike other refs in this codebase that
	// only ever get attached via JSX/other hooks.
	const containerRef = useRef<HTMLDivElement | null>(null);
	useClickOutside(containerRef, () => setRevealed(false));

	const setRefs = (node: HTMLDivElement | null) => {
		setNodeRef(node);
		containerRef.current = node;
	};

	const startMinutes = timeToMinutes(event.startTime);
	const endMinutes = timeToMinutes(event.endTime);
	const top = (startMinutes / 60) * HOUR_HEIGHT;
	const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 18);

	// Live preview of the new start/end while dragging, mirroring the same
	// pixel-to-minutes math TimeGrid's onDragEnd applies on drop — otherwise the
	// block visually moves but its time label stays frozen until you let go.
	const dragOffsetMinutes = isDragging ? ((transform?.y ?? 0) / HOUR_HEIGHT) * 60 : 0;
	const displayStartTime = isDragging ? minutesToTime(startMinutes + dragOffsetMinutes) : event.startTime;
	const displayEndTime = isDragging ? minutesToTime(endMinutes + dragOffsetMinutes) : event.endTime;

	// Mouse users get the handles on hover before they ever click, so this always
	// opens the detail drawer for them (unchanged from before). Touch users have
	// no hover: their first tap only reveals the handles, and a second tap on the
	// body (rather than a handle) opens the drawer.
	const handleClick = () => {
		if (!revealed) {
			setRevealed(true);
			return;
		}
		onSelect();
	};

	const makeResizeHandler = (edge: 'start' | 'end') => (downEvent: ReactPointerEvent) => {
		downEvent.stopPropagation();
		downEvent.preventDefault();
		const startY = downEvent.clientY;

		const handleMove = (moveEvent: PointerEvent) => {
			const deltaMinutes = ((moveEvent.clientY - startY) / HOUR_HEIGHT) * 60;
			if (edge === 'start') {
				const nextStart = Math.max(0, Math.min(endMinutes - SNAP_MINUTES, startMinutes + deltaMinutes));
				onResize({ startTime: minutesToTime(nextStart) });
			} else {
				const nextEnd = Math.max(startMinutes + SNAP_MINUTES, endMinutes + deltaMinutes);
				onResize({ endTime: minutesToTime(nextEnd) });
			}
		};
		const handleUp = () => {
			window.removeEventListener('pointermove', handleMove);
			window.removeEventListener('pointerup', handleUp);
		};
		window.addEventListener('pointermove', handleMove);
		window.addEventListener('pointerup', handleUp);
	};

	return (
		<div
			ref={setRefs}
			style={{
				top,
				height,
				left: `${overlapIndex * 10}%`,
				width: `${100 - overlapIndex * 10}%`,
				zIndex: 10 + overlapIndex,
				transform: CSS.Translate.toString(transform),
				opacity: isDragging ? 0.6 : 1,
			}}
			{...attributes}
			{...listeners}
			onMouseEnter={() => setRevealed(true)}
			onMouseLeave={() => setRevealed(false)}
			onClick={handleClick}
			className={`absolute cursor-grab rounded-lg border border-black/5 shadow-sm active:cursor-grabbing ${TAG_COLOR_META[event.color].bg} ${TAG_COLOR_META[event.color].text}`}
		>
			<div className="h-full overflow-hidden px-1.5 py-0.5 text-left text-[11px]">
				<div className="truncate font-semibold">{event.title}</div>
				{!event.allDay && (
					<div className="truncate opacity-70">
						{displayStartTime}–{displayEndTime}
					</div>
				)}
			</div>
			{!event.allDay && revealed && (
				<>
					<div
						onPointerDown={makeResizeHandler('start')}
						onClick={(e) => e.stopPropagation()}
						className={`${resizeHandleClass} -top-1.5`}
					/>
					<div
						onPointerDown={makeResizeHandler('end')}
						onClick={(e) => e.stopPropagation()}
						className={`${resizeHandleClass} -bottom-1.5`}
					/>
				</>
			)}
		</div>
	);
}
