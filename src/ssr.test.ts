import { execFile } from 'node:child_process';
import { createSign, generateKeyPairSync } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { promisify } from 'node:util';

import { createServer, preview, type PreviewServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

// Drives the real hooks, layouts, and pages through SvelteKit's dev server and a production
// build. Clerk verifies a locally signed session token with a fake production instance's JWT
// key, and the Convex URL points at this machine, so nothing leaves it.

const convexUrl = 'http://127.0.0.1:3210';

const frontendApi = 'clerk.budge.test';
const userId = 'user_test_owner';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const clerkEnv = {
	PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from(`${frontendApi}$`).toString('base64')}`,
	CLERK_SECRET_KEY: 'sk_live_not_a_real_key',
	CLERK_JWT_KEY: publicKey.export({ type: 'spki', format: 'pem' }).toString()
};

function base64url(value: object) {
	return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sessionCookie() {
	const now = Math.floor(Date.now() / 1000);
	const header = base64url({ alg: 'RS256', typ: 'JWT', kid: 'ins_test' });
	const payload = base64url({
		iss: `https://${frontendApi}`,
		sub: userId,
		sid: 'sess_test',
		azp: 'http://localhost',
		iat: now - 5,
		nbf: now - 5,
		exp: now + 60
	});
	const signature = createSign('RSA-SHA256')
		.update(`${header}.${payload}`)
		.sign(privateKey)
		.toString('base64url');
	return `__session=${header}.${payload}.${signature}; __client_uat=${String(now - 10)}`;
}

async function withEnv<T>(env: Record<string, string>, start: () => Promise<T>) {
	for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
	try {
		return await start();
	} finally {
		vi.unstubAllEnvs();
	}
}

function startApp(env: Record<string, string>) {
	return withEnv(env, async () => {
		const server = await createServer({
			configFile: 'vite.config.ts',
			logLevel: 'silent',
			server: { port: 0, host: '127.0.0.1', hmr: false, watch: null }
		});
		await server.listen();
		return server;
	});
}

function get(server: ViteDevServer | PreviewServer, path: string, signedIn: boolean) {
	const { port } = server.httpServer?.address() as AddressInfo;
	return fetch(`http://127.0.0.1:${String(port)}${path}`, {
		redirect: 'manual',
		headers: signedIn ? { cookie: sessionCookie(), accept: 'text/html' } : { accept: 'text/html' }
	});
}

describe('server-rendered pages', () => {
	describe('with the app configured', () => {
		let server: ViteDevServer;
		beforeAll(async () => {
			server = await startApp({
				...clerkEnv,
				PUBLIC_CONVEX_URL: convexUrl
			});
		});
		afterAll(() => server.close());

		test('the signed-in Budget page is private and never cached', async () => {
			const response = await get(server, '/', true);
			expect(response.status).toBe(200);
			expect(response.headers.get('cache-control')).toBe('private, no-store');
		});

		test('the sign-in page is never cached', async () => {
			const response = await get(server, '/sign-in', false);
			expect(response.status).toBe(200);
			expect(response.headers.get('cache-control')).toBe('private, no-store');
		});
	});

	describe('when a signed-in page fails to render', () => {
		let server: ViteDevServer;
		beforeAll(async () => {
			// A missing Convex URL makes the app shell throw while rendering.
			server = await startApp({ ...clerkEnv, PUBLIC_CONVEX_URL: '' });
		});
		afterAll(() => server.close());

		test('the error page renders privately with the render error, not a header clash', async () => {
			const errors: unknown[] = [];
			const original = console.error;
			console.error = (...args: unknown[]) => errors.push(args);
			try {
				const response = await get(server, '/', true);
				expect(response.status).toBe(500);
				expect(response.headers.get('cache-control')).toBe('private, no-store');
				expect(await response.text()).toContain('Internal Error');
			} finally {
				console.error = original;
			}
			expect(String(errors)).toContain('PUBLIC_CONVEX_URL is not set.');
			expect(String(errors)).not.toContain('header is already set');
		});
	});

	describe('in a build deployed without the Convex URL in its runtime env', () => {
		let server: PreviewServer;
		beforeAll(async () => {
			// `convex deploy` gives each deployment's URL to the build command only.
			await promisify(execFile)('node_modules/.bin/vite', ['build', '--logLevel', 'error'], {
				env: { ...process.env, PUBLIC_CONVEX_URL: convexUrl }
			});
			// Empty rather than unset, so a developer's `.env.local` can't fill it in.
			server = await withEnv({ ...clerkEnv, PUBLIC_CONVEX_URL: '' }, () =>
				preview({
					configFile: 'vite.config.ts',
					logLevel: 'silent',
					preview: { port: 0, host: '127.0.0.1', open: false }
				})
			);
		}, 120_000);
		afterAll(() => server.close());

		test('the signed-in Budget page renders with the URL the build was given', async () => {
			const response = await get(server, '/', true);
			expect(response.status).toBe(200);
			expect(response.headers.get('cache-control')).toBe('private, no-store');
		});
	});
});
