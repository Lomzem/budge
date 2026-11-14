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

interface Drag {
	readonly items: HTMLElement[];
	readonly from: number;
	readonly startY: number;
	readonly pitch: number;
	readonly centers: number[];
	to: number;
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

		function down(event: PointerEvent) {
			if (event.button !== 0) return;
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
				items,
				from,
				startY: event.clientY,
				pitch: own.height + gap,
				centers: boxes.map((box) => box.top + box.height / 2),
				to: from
			};
		}

		function move(event: PointerEvent) {
			if (drag === null) return;
			const { items, from, centers, pitch } = drag;
			const offset = event.clientY - drag.startY;
			const center = (centers[from] ?? 0) + offset;
			const to = centers.filter((other, at) => at !== from && other < center).length;
			drag.to = to;
			items.forEach((item, at) => {
				if (at === from) shift(item, offset);
				else if (from < to && at > from && at <= to) shift(item, -pitch);
				else if (to < from && at >= to && at < from) shift(item, pitch);
				else shift(item, 0);
			});
		}

		function up() {
			if (drag === null) return;
			const { items, from, to } = drag;
			drag = null;
			for (const item of items) {
				shift(item, 0);
				delete item.dataset.dragging;
			}
			if (to !== from) onmove(to);
		}

		function key(event: KeyboardEvent) {
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
		handle.addEventListener('pointerup', up);
		handle.addEventListener('pointercancel', up);
		handle.addEventListener('keydown', key);
		return () => {
			handle.removeEventListener('pointerdown', down);
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
			handle.removeEventListener('pointercancel', up);
			handle.removeEventListener('keydown', key);
		};
	};
}
