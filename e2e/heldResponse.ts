import type { Page, WebSocketRoute } from '@playwright/test';

type Frame = string | Buffer;

function parse(frame: Frame): { type?: unknown; udfPath?: unknown; requestId?: unknown } {
	if (typeof frame !== 'string') return {};
	const message: unknown = JSON.parse(frame);
	return typeof message === 'object' && message !== null ? message : {};
}

export async function holdResponseTo(page: Page, udfPath: string) {
	const requestIds = new Set<unknown>();
	const queued: Frame[] = [];
	let browser: WebSocketRoute | undefined;
	let holding = false;
	const { promise: held, resolve: markHeld } = Promise.withResolvers<undefined>();

	await page.routeWebSocket(/\/api\/[^/]+\/sync$/, (socket) => {
		browser = socket;
		const server = socket.connectToServer();
		socket.onMessage((frame) => {
			const message = parse(frame);
			if (
				(message.type === 'Mutation' || message.type === 'Action') &&
				message.udfPath === udfPath
			) {
				requestIds.add(message.requestId);
			}
			server.send(frame);
		});
		server.onMessage((frame) => {
			const message = parse(frame);
			const response = message.type === 'MutationResponse' || message.type === 'ActionResponse';
			if (response && requestIds.has(message.requestId)) {
				holding = true;
				markHeld(undefined);
			}
			if (holding) queued.push(frame);
			else socket.send(frame);
		});
	});

	return {
		held,
		release() {
			holding = false;
			for (const frame of queued.splice(0)) browser?.send(frame);
		}
	};
}
