import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';

import { fakeCheckout, hermeticEnv, removeFakeCheckouts } from '../test-support';
import { claimBackendPorts } from './backend';

const servers: Server[] = [];
const children: ChildProcess[] = [];

afterEach(async () => {
	for (const child of children.splice(0)) {
		if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
	}
	await Promise.all(
		servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))
	);
	removeFakeCheckouts();
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

const CONFIG = '.convex/local/default/config.json';

function checkoutWithConfigOn(cloud: number) {
	return fakeCheckout({
		[CONFIG]: JSON.stringify({
			ports: { cloud, site: cloud + 1 },
			backendVersion: 'invented-version',
			adminKey: 'anonymous-agent|invented-admin-key-0000',
			instanceSecret: 'invented-instance-secret',
			deploymentName: 'anonymous-agent'
		})
	});
}

function savedConfig(checkout: string) {
	return JSON.parse(readFileSync(join(checkout, CONFIG), 'utf8')) as {
		ports: { cloud: number; site: number };
		adminKey: string;
	};
}

test("keeps the local config's ports while they are free", async () => {
	const free = await occupy();
	await new Promise((resolve) => servers.pop()?.close(resolve));
	const checkout = checkoutWithConfigOn(free);

	expect(await claimBackendPorts(checkout)).toEqual({ cloud: free, site: free + 1 });
});

test('moves the local config to free ports when another server holds its port', async () => {
	const held = await occupy();
	const checkout = checkoutWithConfigOn(held);

	const ports = await claimBackendPorts(checkout);

	expect(ports.cloud).not.toBe(held);
	expect(ports.site).not.toBe(ports.cloud);
	expect(savedConfig(checkout).ports).toEqual(ports);
	expect(savedConfig(checkout).adminKey).toBe('anonymous-agent|invented-admin-key-0000');
});

test('keeps both backend ports valid and distinct when the config sits on the last port', async () => {
	const checkout = checkoutWithConfigOn(65535);

	const ports = await claimBackendPorts(checkout);

	for (const port of [ports.cloud, ports.site]) {
		expect(port).toBeGreaterThanOrEqual(1024);
		expect(port).toBeLessThanOrEqual(65535);
	}
	expect(ports.site).not.toBe(ports.cloud);
	expect(savedConfig(checkout).ports).toEqual(ports);
});

test("refuses while a backend for this checkout's local state is still running", async () => {
	const held = await occupy();
	const checkout = checkoutWithConfigOn(held);
	const sqlite = join(checkout, '.convex/local/default/convex_local_backend.sqlite3');
	children.push(
		spawn('sh', ['-c', 'sleep 300; true', 'backend', sqlite], {
			env: hermeticEnv(),
			stdio: 'ignore',
			detached: true
		})
	);
	await new Promise((resolve) => setTimeout(resolve, 200));

	await expect(claimBackendPorts(checkout)).rejects.toThrow(/still running/);
	expect(savedConfig(checkout).ports.cloud).toBe(held);
});
