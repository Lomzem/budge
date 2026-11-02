import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	claimBackendPorts,
	runConvex,
	spawnAnonymousBackend,
	waitForAnonymousBackend
} from '../scripts/local/backend';
import { copyCheckout, findCheckout, requireInstalled } from '../scripts/local/checkout';
import { loadCredentials } from '../scripts/local/credentials';
import { inheritedEnvWithoutDeploymentSettings } from '../scripts/local/env-file';
import { exitCode, portInUse, stopProcessGroup } from '../scripts/local/processes';
import { redact, redactInto } from '../scripts/local/redaction';

const PREVIEW_PORT = 4173;

async function main() {
	const { checkout, mainCheckout } = findCheckout();
	requireInstalled(checkout);

	const credentials = loadCredentials(mainCheckout);
	if (await portInUse(PREVIEW_PORT)) {
		throw new Error(
			`port ${String(PREVIEW_PORT)} is in use; stop that server so Playwright builds its own preview.`
		);
	}

	const workdir = mkdtempSync(join(tmpdir(), 'budge-e2e-'));
	console.log(`e2e-local: copying ${checkout} into ${workdir}`);
	copyCheckout(checkout, workdir);

	const logPath = join(workdir, 'convex.log');
	const ports = await claimBackendPorts(workdir);
	const backend = spawnAnonymousBackend(workdir, logPath, ports);

	let succeeded = false;
	const cleanUp = async () => {
		if (backend.pid !== undefined) await stopProcessGroup(backend.pid);
		if (succeeded) rmSync(workdir, { recursive: true, force: true });
		else
			console.error(`e2e-local: kept ${workdir} (convex.log, playwright-report/) for debugging.`);
	};
	for (const [signal, code] of [
		['SIGINT', 130],
		['SIGTERM', 143]
	] as const) {
		process.once(
			signal,
			() =>
				void cleanUp().finally(() => {
					restoreCheckoutTypes();
					process.exit(code);
				})
		);
	}

	try {
		const deployment = await waitForAnonymousBackend(backend, workdir, logPath, ports, credentials);
		console.log(
			`e2e-local: target: local-anonymous (${deployment.name.split(':')[1] ?? ''}, ${deployment.url})`
		);

		if ((await runConvex(deployment, workdir, ['run', 'seed:run'])) !== 0)
			throw new Error('seed:run failed');

		const playwright = spawn(
			process.execPath,
			['x', 'playwright', 'test', ...process.argv.slice(2)],
			{
				cwd: workdir,
				env: {
					...inheritedEnvWithoutDeploymentSettings(),
					PUBLIC_CONVEX_URL: deployment.url,
					PUBLIC_CLERK_PUBLISHABLE_KEY: credentials.PUBLIC_CLERK_PUBLISHABLE_KEY,
					CLERK_SECRET_KEY: credentials.CLERK_SECRET_KEY,
					E2E_CLERK_USER_EMAIL: credentials.E2E_CLERK_USER_EMAIL
				},
				stdio: ['inherit', 'pipe', 'pipe']
			}
		);
		redactInto(playwright.stdout, process.stdout);
		redactInto(playwright.stderr, process.stderr);
		const code = await exitCode(playwright);
		succeeded = code === 0;
		await cleanUp();
		process.exitCode = code;
	} catch (error) {
		console.error(`e2e-local: ${redact(error instanceof Error ? error.message : String(error))}`);
		await cleanUp();
		process.exitCode = 1;
	}
}

function restoreCheckoutTypes() {
	try {
		execFileSync(process.execPath, ['run', 'sync'], { stdio: 'inherit' });
	} catch {
		console.error('e2e-local: restoring checkout types failed.');
		process.exitCode = 1;
	}
}

try {
	await main();
} catch (error) {
	console.error(`e2e-local: ${redact(error instanceof Error ? error.message : String(error))}`);
	process.exitCode = 1;
} finally {
	restoreCheckoutTypes();
}
