import { createServer, type Server } from 'node:net';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, test } from 'vitest';

import { freePort } from './processes';

const servers: Server[] = [];

afterEach(async () => {
	await Promise.all(
		servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))
	);
});

function occupy() {
	const server = createServer();
	servers.push(server);
	return new Promise<number>((resolve) => {
		server.listen(0, '127.0.0.1', () => {
			resolve((server.address() as AddressInfo).port);
		});
	});
}

test('freePort skips a port another server holds, and ports already handed out', async () => {
	const held = await occupy();

	const port = await freePort(held, [held + 1]);

	expect(port).toBeGreaterThan(held + 1);
	expect(port).toBeLessThan(held + 100);
});

test.each([65535, 65536])('freePort wraps from %i and respects taken ports', async (preferred) => {
	const port = await freePort(preferred, [65535, 1]);
	expect(port).toBeGreaterThanOrEqual(2);
	expect(port).toBeLessThan(100);
});
