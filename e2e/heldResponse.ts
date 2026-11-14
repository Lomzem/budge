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
		landEarliest(): number {
			const responses = queued.flatMap((frame, index) => (callOf(frame) === -1 ? [] : [index]));
			const [earliest, next] = responses;
			const frame = earliest === undefined ? undefined : queued[earliest];
			if (frame === undefined) throw new Error(`No ${udfPath} response is held`);
			for (const sent of queued.splice(0, next ?? queued.length)) browser?.send(sent);
			return callOf(frame);
		},
		release() {
			holding = false;
			released = true;
			for (const frame of queued.splice(0)) browser?.send(frame);
		}
	};
}

export async function answerInsteadOfServer(page: Page, ...udfPaths: string[]) {
	const asked = new Map(udfPaths.map((udfPath) => [udfPath, [] as unknown[]]));
	const arrived = new Map<string, () => void>();
	let browser: WebSocketRoute | undefined;

	await page.routeWebSocket(/\/api\/[^/]+\/sync$/, (socket) => {
		browser = socket;
		const server = socket.connectToServer();
		socket.onMessage((frame) => {
			const message = parse(frame);
			const udfPath = typeof message.udfPath === 'string' ? message.udfPath : '';
			const waiting = message.type === 'Action' ? asked.get(udfPath) : undefined;
			if (waiting === undefined) {
				server.send(frame);
				return;
			}
			waiting.push(message.requestId);
			arrived.get(udfPath)?.();
		});
		server.onMessage((frame) => {
			socket.send(frame);
		});
	});

	const waitingFor = (udfPath: string) => {
		const waiting = asked.get(udfPath);
		if (waiting === undefined) throw new Error(`${udfPath} is not answered here`);
		return waiting;
	};
	const called = async (udfPath: string) => {
		const waiting = waitingFor(udfPath);
		while (waiting.length === 0) {
			const { promise, resolve } = Promise.withResolvers<undefined>();
			arrived.set(udfPath, () => {
				resolve(undefined);
			});
			await promise;
		}
		return waiting;
	};
	const respond = async (udfPath: string, response: object) => {
		const requestId = (await called(udfPath)).shift();
		browser?.send(JSON.stringify({ type: 'ActionResponse', requestId, logLines: [], ...response }));
	};

	return {
		async called(udfPath: string) {
			await called(udfPath);
		},
		async answer(udfPath: string, result: unknown) {
			await respond(udfPath, { success: true, result });
		},
		async refuse(udfPath: string, error: { code: string; message: string }) {
			await respond(udfPath, { success: false, result: error.message, errorData: error });
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

interface Modification {
	type?: unknown;
	queryId?: unknown;
}

interface Transition {
	type: 'Transition';
	endVersion?: unknown;
	modifications?: Modification[];
}

function assembledTransition(frame: Frame, chunks: string[]): Transition | 'partial' | undefined {
	const message = parse(frame) as {
		type?: unknown;
		chunk?: string;
		partNumber?: number;
		totalParts?: number;
	};
	if (message.type === 'Transition') return message as Transition;
	if (message.type !== 'TransitionChunk') return undefined;
	chunks.push(message.chunk ?? '');
	if (chunks.length < (message.totalParts ?? 0)) return 'partial';
	return parse(chunks.splice(0).join('')) as Transition;
}

export async function withholdQueryResult(page: Page, udfPath: string) {
	const queryIds = new Set<unknown>();
	const withheld = new Map<unknown, Modification>();
	const chunks: string[] = [];
	let browser: WebSocketRoute | undefined;
	let lastVersion: unknown;
	let withholding = true;
	const { promise: dropped, resolve: markDropped } = Promise.withResolvers<undefined>();

	await page.routeWebSocket(/\/api\/[^/]+\/sync$/, (socket) => {
		browser = socket;
		const server = socket.connectToServer();
		socket.onMessage((frame) => {
			const message = parse(frame) as {
				type?: unknown;
				modifications?: { type?: unknown; queryId?: unknown; udfPath?: unknown }[];
			};
			if (message.type === 'ModifyQuerySet') {
				for (const change of message.modifications ?? []) {
					if (change.type === 'Add' && change.udfPath === udfPath) queryIds.add(change.queryId);
					if (change.type === 'Remove' && queryIds.has(change.queryId)) markDropped(undefined);
				}
			}
			server.send(frame);
		});
		server.onMessage((frame) => {
			const transition = withholding ? assembledTransition(frame, chunks) : undefined;
			if (transition === 'partial') return;
			if (transition === undefined) {
				socket.send(frame);
				return;
			}
			lastVersion = transition.endVersion;
			const passed: Modification[] = [];
			for (const change of transition.modifications ?? []) {
				if (!queryIds.has(change.queryId)) passed.push(change);
				else if (change.type === 'QueryRemoved') withheld.delete(change.queryId);
				else withheld.set(change.queryId, change);
			}
			socket.send(JSON.stringify({ ...transition, modifications: passed }));
		});
	});

	return {
		dropped,
		release() {
			withholding = false;
			if (withheld.size === 0) return;
			browser?.send(
				JSON.stringify({
					type: 'Transition',
					startVersion: lastVersion,
					endVersion: lastVersion,
					modifications: [...withheld.values()]
				})
			);
			withheld.clear();
		}
	};
}
