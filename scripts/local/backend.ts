import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { Credentials } from './credentials';
import {
	checkLocalAnonymousDeployment,
	localConfigPath,
	readLocalConfig,
	requireNoDeploymentOverrides,
	type LocalDeployment
} from './deployment';
import { inheritedEnvWithoutDeploymentSettings } from './env-file';
import { spawnLogged } from './logged';
import { exitCode, freePort, reachable, waitFor } from './processes';
import { redactInto } from './redaction';

export interface BackendPorts {
	cloud: number;
	site: number;
}

export const convexCli = join(
	dirname(createRequire(import.meta.url).resolve('convex/package.json')),
	'bin',
	'main.js'
);

export function anonymousConvexEnv(): NodeJS.ProcessEnv {
	return { ...inheritedEnvWithoutDeploymentSettings(), CONVEX_AGENT_MODE: 'anonymous' };
}

export async function runConvex(
	deployment: LocalDeployment,
	dir: string,
	args: string[],
	stdin?: string
) {
	const binding = mkdtempSync(join(tmpdir(), 'budge-convex-'));
	const envFile = join(binding, 'deployment.env');
	writeFileSync(
		envFile,
		`CONVEX_SELF_HOSTED_URL=${deployment.url}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${deployment.adminKey}\n`,
		{ mode: 0o600 }
	);
	try {
		const child = spawn(
			process.execPath,
			[...noAutomaticEnvFile(), convexCli, ...args, '--env-file', envFile],
			{
				cwd: dir,
				env: inheritedEnvWithoutDeploymentSettings(),
				stdio: ['pipe', 'pipe', 'pipe']
			}
		);
		redactInto(child.stdout, process.stdout);
		redactInto(child.stderr, process.stderr);
		child.stdin.end(stdin);
		return await exitCode(child);
	} finally {
		rmSync(binding, { recursive: true, force: true });
	}
}

function noAutomaticEnvFile() {
	return process.versions.bun === undefined ? [] : ['--no-env-file'];
}

function backendStillRunning(dir: string) {
	try {
		execFileSync(
			'pgrep',
			['-f', '--', join(dirname(localConfigPath(dir)), 'convex_local_backend')],
			{
				stdio: 'ignore'
			}
		);
		return true;
	} catch {
		return false;
	}
}

function moveLocalConfig(dir: string, ports: BackendPorts) {
	const path = localConfigPath(dir);
	if (!existsSync(path)) return;
	const config = JSON.parse(readFileSync(path, 'utf8')) as { ports?: BackendPorts };
	if (config.ports?.cloud === ports.cloud && config.ports.site === ports.site) return;
	writeFileSync(path, `${JSON.stringify({ ...config, ports }, null, 2)}\n`);
}

export async function claimBackendPorts(dir: string, preferred?: number): Promise<BackendPorts> {
	if (backendStillRunning(dir)) {
		throw new Error(
			"a backend for this checkout's .convex/local is still running outside `bun run app up`; stop it first."
		);
	}
	const cloud = await freePort(preferred ?? readLocalConfig(dir)?.cloudPort ?? 3210);
	const site = await freePort(cloud + 1, [cloud]);
	moveLocalConfig(dir, { cloud, site });
	return { cloud, site };
}

function anonymousSelection(dir: string) {
	const path = join(dir, '.local-app', 'convex-dev.env');
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	writeFileSync(path, 'CONVEX_DEPLOYMENT=anonymous:anonymous-agent\n');
	return path;
}

export function spawnAnonymousBackend(dir: string, logPath: string, ports: BackendPorts) {
	requireNoDeploymentOverrides(dir, 'start the local backend');
	return spawnLogged({
		cwd: dir,
		logPath,
		env: anonymousConvexEnv(),
		secretConfig: localConfigPath(dir),
		command: [
			process.execPath,
			'--no-env-file',
			convexCli,
			'dev',
			'--typecheck',
			'disable',
			'--codegen',
			'disable',
			'--env-file',
			anonymousSelection(dir),
			'--local-cloud-port',
			String(ports.cloud),
			'--local-site-port',
			String(ports.site)
		]
	});
}

function servedDeployment(dir: string, ports: BackendPorts) {
	const check = checkLocalAnonymousDeployment(dir);
	if (!check.local) return undefined;
	return check.deployment.url === `http://127.0.0.1:${String(ports.cloud)}`
		? check.deployment
		: undefined;
}

export async function waitForAnonymousBackend(
	backend: ChildProcess,
	dir: string,
	logPath: string,
	ports: BackendPorts,
	credentials: Credentials
) {
	let backendExited = false;
	void exitCode(backend).then(() => {
		backendExited = true;
	});
	const stillRunning = () => {
		if (backendExited) throw new Error('`convex dev` exited early');
	};

	let deployment: LocalDeployment | undefined;
	await waitFor('the anonymous backend', 180, async () => {
		stillRunning();
		deployment = servedDeployment(dir, ports);
		return deployment !== undefined && (await reachable(`${deployment.url}/version`));
	});
	if (deployment === undefined) throw new Error('the anonymous backend did not start');

	for (const [name, value] of [
		['CLERK_JWT_ISSUER_DOMAIN', credentials.CLERK_JWT_ISSUER_DOMAIN],
		['BUDGE_OWNER_SUBJECT', credentials.E2E_CLERK_USER_ID]
	] as const) {
		if ((await runConvex(deployment, dir, ['env', 'set', name], value)) !== 0) {
			throw new Error(`setting ${name} failed`);
		}
	}
	await waitFor('Convex functions', 120, () => {
		stillRunning();
		return readFileSync(logPath, 'utf8').includes('Convex functions ready');
	});
	return deployment;
}
