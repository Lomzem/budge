import type { Page } from '@playwright/test';

export interface LayoutShift {
	url: string;
	value: number;
	moved: string[];
}

const BINDING = '__budgeLayoutShift';

function observeLayoutShifts(binding: string) {
	interface Entry extends PerformanceEntry {
		value: number;
		hadRecentInput: boolean;
		sources?: { node?: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
	}
	const labelOf = (element: Element) =>
		element.getAttribute('aria-label') ?? element.textContent.trim().replace(/\s+/g, ' ');
	const describe = (node: Node | null | undefined) => {
		if (!(node instanceof Element)) return node?.nodeName ?? 'unknown node';
		const named = node.closest('[aria-label], a, button, label, th, td, li, p, h1, h2, h3');
		const label = labelOf(node) || (named ? labelOf(named) : '');
		return `<${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}> ${label.slice(0, 60)}`;
	};
	const box = (rect: DOMRectReadOnly) =>
		[rect.x, rect.y, rect.width, rect.height].map((n) => n.toFixed(1)).join(',');
	const RECENT_INPUT_MS = 500;
	let lastEdit = -Infinity;
	const noteEdit = (event: Event) => {
		lastEdit = event.timeStamp;
	};
	addEventListener('input', noteEdit, true);
	addEventListener('change', noteEdit, true);
	const pending = new Set<Promise<void>>();
	const reportAll = (entries: Entry[]) => {
		const report = (window as unknown as Record<string, (shift: LayoutShift) => Promise<void>>)[
			binding
		];
		for (const entry of entries) {
			if (entry.hadRecentInput || entry.startTime - lastEdit < RECENT_INPUT_MS) continue;
			const sent = report?.({
				url: location.pathname + location.search,
				value: entry.value,
				moved: (entry.sources ?? []).map(
					(source) =>
						`${describe(source.node)} [${box(source.previousRect)} → ${box(source.currentRect)}]`
				)
			});
			if (sent === undefined) continue;
			pending.add(sent);
			void sent.finally(() => pending.delete(sent));
		}
	};
	const observer = new PerformanceObserver((list) => {
		reportAll(list.getEntries() as Entry[]);
	});
	observer.observe({ type: 'layout-shift', buffered: true });
	(window as unknown as Record<string, () => Promise<void>>)[`${binding}Drain`] = async () => {
		await new Promise((painted) => requestAnimationFrame(() => requestAnimationFrame(painted)));
		reportAll(observer.takeRecords() as Entry[]);
		await Promise.all(pending);
	};
}

export async function watchUnpromptedLayoutShifts(page: Page) {
	const shifts: LayoutShift[] = [];
	await page.exposeFunction(BINDING, (shift: LayoutShift) => {
		shifts.push(shift);
	});
	await page.addInitScript(observeLayoutShifts, BINDING);
	return {
		shifts,
		async assertNone() {
			if (!page.isClosed()) {
				await page.evaluate(
					(drain) =>
						(window as unknown as Record<string, (() => Promise<void>) | undefined>)[drain]?.(),
					`${BINDING}Drain`
				);
			}
			if (shifts.length === 0) return;
			const lines = shifts.map(
				(shift) => `  ${shift.url} moved by ${shift.value.toFixed(4)}: ${shift.moved.join('; ')}`
			);
			throw new Error(`The page shifted without user input:\n${lines.join('\n')}`);
		}
	};
}
