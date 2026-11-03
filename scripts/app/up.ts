import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
	claimBackendPorts,
	spawnAnonymousBackend,
	waitForAnonymousBackend,
	type BackendPorts
} from '../local/backend';
import { findCheckout, requireInstalled } from '../local/checkout';
import { loadCredentials, type Credentials } from '../local/credentials';
import { deploymentEnvOf, requireNoDeploymentOverrides } from '../local/deployment';
import { inheritedEnvWithoutDeploymentSettings } from '../local/env-file';
import { spawnLogged } from '../local/logged';
import { exitCode, freePort, reachable, waitFor } from '../local/processes';
import { redact } from '../local/redaction';
import { startOwned, withAppStartup, type AppUrls } from './owned';
import { stateDir } from './state';
import type { Verb } from './verb';

const PREFERRED_APP_PORT = 5173;

interface Start {
	checkout: string;
	credentials: Credentials;
	urls: AppUrls;
	ports: BackendPorts;
	appPort: number;
	convexLog: string;
	viteLog: string;
}

function refuseNonAnonymousDeployment(checkout: string) {
	const { name } = deploymentEnvOf(checkout);
	if (name !== '' && !name.startsWith('anonymous:')) {
		throw new Error(
			`refusing to start: this checkout's .env.local targets a ${name.split(':')[0] ?? ''} deployment. ` +
				'Run `bun run app` from a worktree without one, so it gets its own local anonymous backend.'
		);
	}
}

function spawnVite(start: Start) {
	return spawnLogged({
		cwd: start.checkout,
		logPath: start.viteLog,
		env: {
			...inheritedEnvWithoutDeploymentSettings(),
			PUBLIC_CONVEX_URL: start.urls.backendUrl,
			PUBLIC_CLERK_PUBLISHABLE_KEY: start.credentials.PUBLIC_CLERK_PUBLISHABLE_KEY,
			CLERK_SECRET_KEY: start.credentials.CLERK_SECRET_KEY
		},
		secretEnv: ['CLERK_SECRET_KEY', 'PUBLIC_CLERK_PUBLISHABLE_KEY'],
		command: [
			process.execPath,
			'x',
			'vite',
			'dev',
			'--host',
			'127.0.0.1',
			'--port',
			String(start.appPort),
			'--strictPort'
		]
	});
}

async function startApp(start: Start) {
	const { checkout, urls } = start;
	console.log('app: starting the local anonymous backend…');
	const backend = await startOwned(checkout, urls, 'backend', () =>
		spawnAnonymousBackend(checkout, start.convexLog, start.ports)
	);
	await waitForAnonymousBackend(backend, checkout, start.convexLog, start.ports, start.credentials);
	console.log('app: starting Vite…');
	const vite = await startOwned(checkout, urls, 'vite', () => spawnVite(start));
	let viteExited = false;
	void exitCode(vite).then(() => {
		viteExited = true;
	});
	await waitFor('Vite', 60, () => {
		if (viteExited) throw new Error('`vite dev` exited early');
		return reachable(urls.appUrl);
	});
	backend.unref();
	vite.unref();
}

function logTails(start: Start) {
	return [start.convexLog, start.viteLog]
		.filter((path) => existsSync(path))
		.map((path) => {
			const tail = readFileSync(path, 'utf8').split('\n').slice(-20).join('\n');
			return `app: ${path} ends with:\n${redact(tail)}`;
		});
}

async function planStart(checkout: string, mainCheckout: string): Promise<Start> {
	refuseNonAnonymousDeployment(checkout);
	requireNoDeploymentOverrides(checkout, 'start');
	const credentials = loadCredentials(mainCheckout);
	const ports = await claimBackendPorts(checkout);
	const appPort = await freePort(PREFERRED_APP_PORT, [ports.cloud, ports.site]);
	const dir = stateDir(checkout);
	return {
		checkout,
		credentials,
		ports,
		appPort,
		urls: {
			appUrl: `http://127.0.0.1:${String(appPort)}`,
			backendUrl: `http://127.0.0.1:${String(ports.cloud)}`
		},
		convexLog: join(dir, 'convex.log'),
		viteLog: join(dir, 'vite.log')
	};
}

export const up: Verb = {
	usage: 'bun run app up',
	summary: 'Start the local anonymous Convex backend and Vite.',
	details: [
		'Starts `convex dev` (anonymous, local, state in .convex/local) and `vite dev`, with the',
		'Clerk development keys `test:e2e:local` uses, and makes the Clerk test user the owner.',
		'Vite takes port 5173 and the backend its configured port, or the next free ones, so worktrees can run side by side; it prints the URLs.',
		'Records the processes in .local-app/running.json and logs, redacted, to .local-app/convex.log and .local-app/vite.log.',
		'Interrupting it stops what it started. Running it again while up changes nothing.'
	].join('\n'),
	run: async () => {
		const { checkout, mainCheckout } = findCheckout();
		requireInstalled(checkout);
		await withAppStartup(checkout, async () => {
			const start = await planStart(checkout, mainCheckout);
			try {
				await startApp(start);
			} catch (error) {
				for (const tail of logTails(start)) console.error(tail);
				throw error;
			}
			console.log('app: next, `bun run app login` and `bun run app seed <fixture>`.');
			return start.urls;
		});
	}
};
