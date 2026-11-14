import { tick } from 'svelte';
import type { Attachment } from 'svelte/attachments';

export function moveInList<T>(items: readonly T[], from: number, to: number): T[] {
	const moved = [...items];
	const [item] = moved.splice(from, 1);
	if (item !== undefined) moved.splice(to, 0, item);
	return moved;
}

const keyTargets: Record<string, (index: number, count: number) => number> = {
	ArrowUp: (index) => index - 1,
	ArrowDown: (index) => index + 1,
	Home: () => 0,
	End: (_, count) => count - 1
};

const EDGE = 72;
const BOTTOM_EDGE_ABOVE_THE_PHONE_TAB_BAR = 136;
const MAX_SCROLL_PER_FRAME = 14;

interface Drag {
	readonly pointerId: number;
	readonly items: HTMLElement[];
	readonly from: number;
	readonly startPageY: number;
	readonly startClientY: number;
	readonly pitch: number;
	readonly pageCenters: number[];
	clientY: number;
	to: number;
	frame: number;
}

function edgeSpeed(clientY: number, startClientY: number) {
	const bottom = window.innerHeight - BOTTOM_EDGE_ABOVE_THE_PHONE_TAB_BAR;
	const intoTop = clientY < startClientY ? Math.min(0, clientY - EDGE) : 0;
	const intoBottom = clientY > startClientY ? Math.max(0, clientY - bottom) : 0;
	const into = intoTop + intoBottom;
	return Math.max(-MAX_SCROLL_PER_FRAME, Math.min(MAX_SCROLL_PER_FRAME, into / 4));
}

export function reorderHandle(
	index: number,
	count: number,
	onmove: (to: number) => void
): Attachment<HTMLElement> {
	return (handle) => {
		let drag: Drag | null = null;

		const shift = (item: HTMLElement, offset: number) => {
			item.style.transform = offset === 0 ? '' : `translateY(${String(offset)}px)`;
		};

		function place(current: Drag) {
			const { items, from, pageCenters, pitch } = current;
			const offset = current.clientY + window.scrollY - current.startPageY;
			const center = (pageCenters[from] ?? 0) + offset;
			const to = pageCenters.filter((other, at) => at !== from && other < center).length;
			current.to = to;
			items.forEach((item, at) => {
				if (at === from) shift(item, offset);
				else if (from < to && at > from && at <= to) shift(item, -pitch);
				else if (to < from && at >= to && at < from) shift(item, pitch);
				else shift(item, 0);
			});
		}

		function scrollNearEdges() {
			if (drag === null) return;
			const speed = edgeSpeed(drag.clientY, drag.startClientY);
			if (speed !== 0) {
				window.scrollBy(0, speed);
				place(drag);
			}
			drag.frame = requestAnimationFrame(scrollNearEdges);
		}

		function end(): Drag | null {
			const ended = drag;
			if (ended === null) return null;
			drag = null;
			cancelAnimationFrame(ended.frame);
			for (const item of ended.items) {
				shift(item, 0);
				delete item.dataset.dragging;
			}
			window.removeEventListener('keydown', escape, true);
			if (handle.hasPointerCapture(ended.pointerId)) handle.releasePointerCapture(ended.pointerId);
			return ended;
		}

		function down(event: PointerEvent) {
			if (event.button !== 0 || drag !== null) return;
			const row = handle.closest<HTMLElement>('[data-reorder-item]');
			const items = [...(row?.parentElement?.children ?? [])].filter(
				(item): item is HTMLElement => item instanceof HTMLElement && 'reorderItem' in item.dataset
			);
			const from = row === null ? -1 : items.indexOf(row);
			if (row === null || from === -1) return;
			const boxes = items.map((item) => item.getBoundingClientRect());
			const next = boxes[from + 1] ?? boxes[from - 1];
			const own = boxes[from];
			if (own === undefined) return;
			const gap = next === undefined ? 0 : Math.max(0, Math.abs(next.top - own.top) - own.height);
			event.preventDefault();
			handle.setPointerCapture(event.pointerId);
			row.dataset.dragging = '';
			drag = {
				pointerId: event.pointerId,
				items,
				from,
				startPageY: event.clientY + window.scrollY,
				startClientY: event.clientY,
				pitch: own.height + gap,
				pageCenters: boxes.map((box) => box.top + window.scrollY + box.height / 2),
				clientY: event.clientY,
				to: from,
				frame: 0
			};
			drag.frame = requestAnimationFrame(scrollNearEdges);
			window.addEventListener('keydown', escape, true);
		}

		function move(event: PointerEvent) {
			if (drag?.pointerId !== event.pointerId) return;
			drag.clientY = event.clientY;
			place(drag);
		}

		function drop(event: PointerEvent) {
			if (drag?.pointerId !== event.pointerId) return;
			const dropped = end();
			if (dropped !== null && dropped.to !== dropped.from) onmove(dropped.to);
		}

		function cancel() {
			end();
		}

		function escape(event: KeyboardEvent) {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			event.stopPropagation();
			cancel();
		}

		function key(event: KeyboardEvent) {
			if (drag !== null) return;
			const target = keyTargets[event.key]?.(index, count);
			if (target === undefined) return;
			event.preventDefault();
			if (target < 0 || target >= count || target === index) return;
			onmove(target);
			void tick().then(() => {
				handle.focus();
			});
		}

		handle.addEventListener('pointerdown', down);
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', drop);
		handle.addEventListener('pointercancel', cancel);
		handle.addEventListener('lostpointercapture', cancel);
		handle.addEventListener('keydown', key);
		return () => {
			cancel();
			handle.removeEventListener('pointerdown', down);
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', drop);
			handle.removeEventListener('pointercancel', cancel);
			handle.removeEventListener('lostpointercapture', cancel);
			handle.removeEventListener('keydown', key);
		};
	};
}
