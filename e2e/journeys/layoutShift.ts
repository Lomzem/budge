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
		sources?: { node?: Node | null }[];
	}
	const describe = (node: Node | null | undefined) => {
		if (!(node instanceof Element)) return node?.nodeName ?? 'unknown node';
		const label = node.getAttribute('aria-label') ?? node.textContent.trim().replace(/\s+/g, ' ');
		return `<${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}> ${label.slice(0, 60)}`;
	};
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries() as Entry[]) {
			if (entry.hadRecentInput) continue;
			const report = (window as unknown as Record<string, (shift: LayoutShift) => void>)[binding];
			report?.({
				url: location.pathname + location.search,
				value: entry.value,
				moved: (entry.sources ?? []).map((source) => describe(source.node))
			});
		}
	}).observe({ type: 'layout-shift', buffered: true });
}

export async function watchUnpromptedLayoutShifts(page: Page) {
	const shifts: LayoutShift[] = [];
	await page.exposeFunction(BINDING, (shift: LayoutShift) => {
		shifts.push(shift);
	});
	await page.addInitScript(observeLayoutShifts, BINDING);
	return {
		shifts,
		assertNone() {
			if (shifts.length === 0) return;
			const lines = shifts.map(
				(shift) => `  ${shift.url} moved by ${shift.value.toFixed(4)}: ${shift.moved.join('; ')}`
			);
			throw new Error(`The page shifted without user input:\n${lines.join('\n')}`);
		}
	};
}
