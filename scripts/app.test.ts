import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, test } from 'vitest';

import { fakeCheckout, removeFakeCheckouts, runApp } from './test-support';

const servers: Server[] = [];

afterEach(async () => {
	removeFakeCheckouts();
	await Promise.all(
		servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))
	);
});

interface SeenRequest {
	path: string;
	authorization: string;
}

async function fakeBackend({ versionStatus = 200 } = {}) {
	const seen: SeenRequest[] = [];
	const server = createServer((request, response) => {
		seen.push({
			path: request.url ?? '',
			authorization: request.headers.authorization ?? ''
		});
		request.resume();
		response.statusCode = request.url === '/version' ? versionStatus : 500;
		response.end(request.url === '/version' ? '"invented"' : '{}');
	});
	servers.push(server);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	return { port, seen, beyondVersion: () => seen.filter((request) => request.path !== '/version') };
}

const ADMIN_KEY = 'anonymous-agent|invented-admin-key-0000';

function localConfig(port: number, overrides: Record<string, unknown> = {}) {
	return JSON.stringify({
		ports: { cloud: port, site: port + 1 },
		backendVersion: 'precompiled-2026-01-01-invented',
		adminKey: ADMIN_KEY,
		instanceSecret: 'invented-instance-secret',
		deploymentName: 'anonymous-agent',
		...overrides
	});
}

function anonymousEnvLocal(port: number) {
	return [
		'CONVEX_DEPLOYMENT=anonymous:anonymous-agent',
		`PUBLIC_CONVEX_URL=http://127.0.0.1:${String(port)}`
	].join('\n');
}

describe('seed --list', () => {
	test('names every fixture an agent can load', async () => {
		const { code, stdout } = await runApp(['seed', '--list']);

		expect(code).toBe(0);
		const names = stdout
			.trim()
			.split('\n')
			.map((line) => line.split(/\s+/)[0]);
		expect(names).toEqual(['empty-budget', 'budget-with-accounts']);
	});
});

const NON_LOCAL_DEPLOYMENTS = {
	'a cloud dev deployment': [
		'CONVEX_DEPLOYMENT=dev:invented-otter-123',
		'PUBLIC_CONVEX_URL=https://invented-otter-123.convex.cloud'
	].join('\n'),
	'a production deployment': [
		'CONVEX_DEPLOYMENT=prod:invented-otter-456',
		'PUBLIC_CONVEX_URL=https://invented-otter-456.convex.cloud'
	].join('\n'),
	"the owner's signed-in local deployment": [
		'CONVEX_DEPLOYMENT=local:local-invented-owner-budge',
		'PUBLIC_CONVEX_URL=http://127.0.0.1:3210'
	].join('\n'),
	'an anonymous name pointing at a cloud URL': [
		'CONVEX_DEPLOYMENT=anonymous:anonymous-agent',
		'PUBLIC_CONVEX_URL=https://invented-otter-123.convex.cloud'
	].join('\n'),
	'no deployment at all': ''
};

const INVENTED_DEPLOY_KEY = 'prod:invented-otter-456|bm90LWEtcmVhbC1rZXk=';

const CONFLICTING_SELECTORS = {
	'a deploy key in .env': { file: '.env', line: `CONVEX_DEPLOY_KEY=${INVENTED_DEPLOY_KEY}` },
	'a deploy key in .env.local': {
		file: '.env.local',
		line: `CONVEX_DEPLOY_KEY=${INVENTED_DEPLOY_KEY}`
	},
	'a self-hosted URL in .env': {
		file: '.env',
		line: 'CONVEX_SELF_HOSTED_URL=https://invented-otter-456.convex.cloud'
	},
	'a cloud deployment in .env': { file: '.env', line: 'CONVEX_DEPLOYMENT=dev:invented-otter-123' }
};

describe.each([['reset'], ['seed', 'budget-with-accounts']])('%s', (...verb) => {
	test.each(Object.entries(NON_LOCAL_DEPLOYMENTS))('refuses %s', async (_, envLocal) => {
		const checkout = fakeCheckout({
			'.env.local': envLocal,
			'.convex/local/default/config.json': localConfig(3210)
		});

		const { code, stdout, stderr } = await runApp(verb, checkout);

		expect(code).toBe(1);
		expect(stderr).toMatch(/refus/i);
		expect(stdout).toBe('');
	});

	test.each(Object.entries(CONFLICTING_SELECTORS))(
		'refuses %s, even beside a running local backend',
		async (_, { file, line }) => {
			const backend = await fakeBackend();
			const files: Record<string, string> = {
				'.env.local': anonymousEnvLocal(backend.port),
				'.convex/local/default/config.json': localConfig(backend.port)
			};
			files[file] = `${files[file] ?? ''}\n${line}\n`;

			const { code, stdout, stderr } = await runApp(verb, fakeCheckout(files));

			expect(code).toBe(1);
			expect(stderr).toMatch(/refus/i);
			expect(stderr).toContain(line.split('=')[0]);
			expect(stdout).toBe('');
			expect(backend.beyondVersion()).toEqual([]);
		}
	);

	test('refuses a deploy key in the process environment', async () => {
		const backend = await fakeBackend();
		const checkout = fakeCheckout({
			'.env.local': anonymousEnvLocal(backend.port),
			'.convex/local/default/config.json': localConfig(backend.port)
		});

		const { code, stderr } = await runApp(verb, checkout, {
			CONVEX_DEPLOY_KEY: INVENTED_DEPLOY_KEY
		});

		expect(code).toBe(1);
		expect(stderr).toMatch(/refus/i);
		expect(stderr).toContain('CONVEX_DEPLOY_KEY');
		expect(backend.beyondVersion()).toEqual([]);
	});

	test('refuses a local config that names a different deployment', async () => {
		const backend = await fakeBackend();
		const checkout = fakeCheckout({
			'.env.local': anonymousEnvLocal(backend.port),
			'.convex/local/default/config.json': localConfig(backend.port, {
				deploymentName: 'anonymous-invented-other'
			})
		});

		const { code, stderr } = await runApp(verb, checkout);

		expect(code).toBe(1);
		expect(stderr).toMatch(/refus/i);
		expect(backend.beyondVersion()).toEqual([]);
	});

	test('refuses a local config that serves a different port', async () => {
		const backend = await fakeBackend();
		const checkout = fakeCheckout({
			'.env.local': anonymousEnvLocal(backend.port),
			'.convex/local/default/config.json': localConfig(backend.port + 7)
		});

		const { code, stderr } = await runApp(verb, checkout);

		expect(code).toBe(1);
		expect(stderr).toMatch(/refus/i);
		expect(backend.beyondVersion()).toEqual([]);
	});
});

test('reset refuses an anonymous deployment whose state is not in this checkout', async () => {
	const checkout = fakeCheckout({ '.env.local': anonymousEnvLocal(3210) });

	const { code, stderr } = await runApp(['reset'], checkout);

	expect(code).toBe(1);
	expect(stderr).toMatch(/refus/i);
});

test("reset talks only to the local config's backend, with its admin key", async () => {
	const backend = await fakeBackend();
	const checkout = fakeCheckout({
		'.env.local': anonymousEnvLocal(backend.port),
		'.convex/local/default/config.json': localConfig(backend.port)
	});

	await runApp(['reset'], checkout, { CONVEX_DEPLOYMENT: 'dev:invented-otter-123' });

	expect(backend.beyondVersion().length).toBeGreaterThan(0);
	for (const request of backend.beyondVersion()) {
		expect(request.authorization).toContain(ADMIN_KEY);
	}
});

test('reset treats a backend that answers with an error as not running', async () => {
	const backend = await fakeBackend({ versionStatus: 500 });
	const checkout = fakeCheckout({
		'.env.local': anonymousEnvLocal(backend.port),
		'.convex/local/default/config.json': localConfig(backend.port)
	});

	const { code, stderr } = await runApp(['reset'], checkout);

	expect(code).toBe(1);
	expect(stderr).toMatch(/not running/);
	expect(backend.beyondVersion()).toEqual([]);
});
