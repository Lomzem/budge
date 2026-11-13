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
	interface RequestedOperation {
		sentAt: number;
		committedAt?: bigint;
		settledAt?: number;
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
	let lastInput = -Infinity;
	const noteInput = (event: Event) => {
		lastInput = event.timeStamp;
	};
	for (const type of ['pointerdown', 'keydown', 'input', 'change']) {
		addEventListener(type, noteInput, true);
	}

	const requested = new Map<string, RequestedOperation>();
	const mutationOrAction = (requestId: unknown) => `request ${String(requestId)}`;
	const subscription = (queryId: unknown) => `query ${String(queryId)}`;
	let syncedThrough = 0n;
	const timestampOf = (encoded: unknown) => {
		if (typeof encoded !== 'string') return undefined;
		const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
		return bytes.reduceRight((value, byte) => (value << 8n) | BigInt(byte), 0n);
	};
	const settleWhenSynced = (now: number) => {
		for (const operation of requested.values()) {
			const { committedAt } = operation;
			if (operation.settledAt === undefined && committedAt !== undefined) {
				if (committedAt <= syncedThrough) operation.settledAt = now;
			}
		}
	};
	const parsed = (data: unknown): Record<string, unknown> => {
		if (typeof data !== 'string') return {};
		const message: unknown = JSON.parse(data);
		return typeof message === 'object' && message !== null
			? (message as Record<string, unknown>)
			: {};
	};
	const transitionChunks: string[] = [];
	const assembled = (message: Record<string, unknown>) => {
		if (message.type !== 'TransitionChunk') return message;
		transitionChunks.push(typeof message.chunk === 'string' ? message.chunk : '');
		if (transitionChunks.length < Number(message.totalParts)) return {};
		return parsed(transitionChunks.splice(0).join(''));
	};
	const modificationsOf = (message: Record<string, unknown>) =>
		(Array.isArray(message.modifications) ? message.modifications : []) as {
			type?: unknown;
			queryId?: unknown;
		}[];
	const settleSubscriptions = (modifications: { queryId?: unknown }[], now: number) => {
		for (const { queryId } of modifications) {
			const operation = requested.get(subscription(queryId));
			if (operation !== undefined) operation.settledAt ??= now;
		}
	};
	const fromServer = (event: MessageEvent) => {
		const message = assembled(parsed(event.data));
		const operation = requested.get(mutationOrAction(message.requestId));
		if (message.type === 'Transition') {
			const endVersion = message.endVersion as { ts?: unknown } | undefined;
			syncedThrough = timestampOf(endVersion?.ts) ?? syncedThrough;
			settleSubscriptions(modificationsOf(message), performance.now());
		} else if (operation !== undefined && message.type === 'MutationResponse') {
			const committedAt = message.success === true ? timestampOf(message.ts) : undefined;
			if (committedAt === undefined) operation.settledAt = performance.now();
			else operation.committedAt = committedAt;
		} else if (operation !== undefined && message.type === 'ActionResponse') {
			operation.settledAt = performance.now();
		}
		settleWhenSynced(performance.now());
	};
	const noteSent = (message: Record<string, unknown>, now: number) => {
		const modifications = message.type === 'ModifyQuerySet' ? modificationsOf(message) : [];
		settleSubscriptions(
			modifications.filter(({ type }) => type === 'Remove'),
			now
		);
		if (now - lastInput >= RECENT_INPUT_MS) return;
		if (message.type === 'Mutation' || message.type === 'Action') {
			requested.set(mutationOrAction(message.requestId), { sentAt: now });
		}
		for (const { type, queryId } of modifications) {
			if (type === 'Add') requested.set(subscription(queryId), { sentAt: now });
		}
	};
	const listening = new WeakSet<WebSocket>();
	const { send } = WebSocket.prototype as { send: (this: WebSocket, data: unknown) => void };
	WebSocket.prototype.send = function (data) {
		if (!listening.has(this)) {
			listening.add(this);
			this.addEventListener('message', fromServer);
		}
		noteSent(parsed(data), performance.now());
		send.call(this, data);
	};
	const answersARequest = (at: number) =>
		[...requested.values()].some(
			({ sentAt, settledAt }) =>
				sentAt <= at && (settledAt === undefined || at - settledAt < RECENT_INPUT_MS)
		);

	const pending = new Set<Promise<void>>();
	const reportAll = (entries: Entry[]) => {
		const report = (window as unknown as Record<string, (shift: LayoutShift) => Promise<void>>)[
			binding
		];
		for (const entry of entries) {
			if (entry.hadRecentInput || entry.startTime - lastInput < RECENT_INPUT_MS) continue;
			if (answersARequest(entry.startTime)) continue;
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
			throw new Error(
				`The page shifted without user input or a requested operation's result:\n${lines.join('\n')}`
			);
		}
	};
}
