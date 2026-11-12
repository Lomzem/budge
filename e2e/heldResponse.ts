import type { Page, WebSocketRoute } from '@playwright/test';

type Frame = string | Buffer;

function parse(frame: Frame): { type?: unknown; udfPath?: unknown; requestId?: unknown } {
	if (typeof frame !== 'string') return {};
	const message: unknown = JSON.parse(frame);
	return typeof message === 'object' && message !== null ? message : {};
}

export async function holdResponseTo(page: Page, udfPath: string) {
	const requestIds: unknown[] = [];
	const callOf = (frame: Frame) => {
		const message = parse(frame);
		const response = message.type === 'MutationResponse' || message.type === 'ActionResponse';
		return response ? requestIds.indexOf(message.requestId) : -1;
	};
	const queued: Frame[] = [];
	let browser: WebSocketRoute | undefined;
	let holding = false;
	let released = false;
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
				requestIds.push(message.requestId);
			}
			server.send(frame);
		});
		server.onMessage((frame) => {
			if (callOf(frame) !== -1 && !released) {
				holding = true;
				markHeld(undefined);
			}
			if (holding) queued.push(frame);
			else socket.send(frame);
		});
	});

	return {
		held,
		releaseEarliest(): number {
			const through = queued.findIndex((frame) => callOf(frame) !== -1);
			const frame = queued[through];
			if (frame === undefined) throw new Error(`No ${udfPath} response is held`);
			for (const sent of queued.splice(0, through + 1)) browser?.send(sent);
			return callOf(frame);
		},
		release() {
			holding = false;
			released = true;
			for (const frame of queued.splice(0)) browser?.send(frame);
		}
	};
}

export async function pausableSync(page: Page) {
	const queued: Frame[] = [];
	let browser: WebSocketRoute | undefined;
	let paused = false;

	await page.routeWebSocket(/\/api\/[^/]+\/sync$/, (socket) => {
		browser = socket;
		const server = socket.connectToServer();
		socket.onMessage((frame) => {
			server.send(frame);
		});
		server.onMessage((frame) => {
			if (paused) queued.push(frame);
			else socket.send(frame);
		});
	});

	return {
		pause() {
			paused = true;
		},
		resume() {
			paused = false;
			for (const frame of queued.splice(0)) browser?.send(frame);
		}
	};
}
