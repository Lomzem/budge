import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	openSync,
	readFileSync,
	rmSync,
	symlinkSync
} from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

const CREDENTIALS = [
	'PUBLIC_CLERK_PUBLISHABLE_KEY',
	'CLERK_SECRET_KEY',
	'CLERK_JWT_ISSUER_DOMAIN',
	'E2E_CLERK_USER_ID',
	'E2E_CLERK_USER_EMAIL'
] as const;
type Credentials = Record<(typeof CREDENTIALS)[number], string>;

const SCRUBBED =
	/^(CONVEX_|PUBLIC_CONVEX_|CLERK_|PUBLIC_CLERK_|BUDGE_|E2E_|DEPLOY_|PLAID_|VERIFIED_)/;

const PREVIEW_PORT = 4173;

function fail(message: string): never {
	throw new Error(message);
}

function git(cwd: string, ...args: string[]) {
	return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function readEnvFile(path: string): Map<string, string> {
	const values = new Map<string, string>();
	if (!existsSync(path)) return values;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
		if (!match?.[1] || match[2] === undefined) continue;
		values.set(match[1], match[2].replace(/^(['"])(.*)\1$/, '$2'));
	}
	return values;
}

function loadCredentials(mainCheckout: string): Credentials {
	const mainEnv = readEnvFile(join(mainCheckout, '.env.local'));
	const missing: string[] = [];
	const credentials = {} as Credentials;
	for (const name of CREDENTIALS) {
		const inherited = process.env[name];
		const value = inherited === undefined || inherited === '' ? mainEnv.get(name) : inherited;
		if (value) credentials[name] = value;
		else missing.push(name);
	}
	if (missing.length > 0) {
		fail(
			`missing ${missing.join(', ')}. Set them in the environment or the main checkout's .env.local ` +
				'(Clerk development instance and its CI test user; see docs/agents/authentication.md).'
		);
	}

	if (!credentials.PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_test_')) {
		fail('PUBLIC_CLERK_PUBLISHABLE_KEY is not a Clerk development key.');
	}
	if (!credentials.CLERK_SECRET_KEY.startsWith('sk_test_')) {
		fail('CLERK_SECRET_KEY is not a Clerk development key.');
	}
	const frontendApi = Buffer.from(
		credentials.PUBLIC_CLERK_PUBLISHABLE_KEY.slice('pk_test_'.length),
		'base64'
	)
		.toString('utf8')
		.replace(/\$$/, '');
	let issuerHost = '';
	try {
		issuerHost = new URL(credentials.CLERK_JWT_ISSUER_DOMAIN).host;
	} catch {
		fail('CLERK_JWT_ISSUER_DOMAIN is not a URL.');
	}
	if (issuerHost !== frontendApi) {
		fail('CLERK_JWT_ISSUER_DOMAIN does not belong to the Clerk instance of the publishable key.');
	}
	if (!credentials.E2E_CLERK_USER_ID.startsWith('user_')) {
		fail('E2E_CLERK_USER_ID is not a Clerk user ID.');
	}
	return credentials;
}

function portInUse(port: number) {
	const probe = (host: string) =>
		new Promise<boolean>((resolve) => {
			const socket = connect({ host, port });
			socket.setTimeout(1000);
			socket.once('connect', () => {
				socket.destroy();
				resolve(true);
			});
			socket.once('timeout', () => {
				socket.destroy();
				resolve(false);
			});
			socket.once('error', () => {
				resolve(false);
			});
		});
	return Promise.all([probe('127.0.0.1'), probe('::1')]).then((results) => results.includes(true));
}

function copyCheckout(checkout: string, workdir: string) {
	const files = git(checkout, 'ls-files', '-z', '--cached', '--others', '--exclude-standard')
		.split('\0')
		.filter(Boolean);
	for (const file of files) {
		const source = join(checkout, file);
		if (!existsSync(source)) continue;
		mkdirSync(dirname(join(workdir, file)), { recursive: true });
		cpSync(source, join(workdir, file), { verbatimSymlinks: true });
	}
	symlinkSync(join(checkout, 'node_modules'), join(workdir, 'node_modules'), 'dir');
}

const CLERK_REFRESH_SESSION_AND_BROWSER_TOKENS = [
	/__clerk_db_jwt=[^&\s]+/g,
	/\b(sess|dvb|sk_test|sk_live)_[A-Za-z0-9]+/g,
	/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g
];

function redactInto(source: Readable, target: Writable, credentials: Credentials) {
	createInterface({ input: source, crlfDelay: Infinity }).on('line', (line) => {
		let redacted = line;
		for (const value of Object.values(credentials))
			redacted = redacted.replaceAll(value, '<redacted>');
		for (const pattern of CLERK_REFRESH_SESSION_AND_BROWSER_TOKENS)
			redacted = redacted.replace(pattern, '<redacted>');
		target.write(`${redacted}\n`);
	});
}

function exitCode(child: ChildProcess) {
	return new Promise<number>((resolve) => {
		child.once('close', (code, signal) => {
			resolve(code ?? (signal ? 1 : 0));
		});
	});
}

async function waitFor(what: string, seconds: number, ready: () => boolean | Promise<boolean>) {
	for (let elapsed = 0; elapsed < seconds; elapsed++) {
		if (await ready()) return;
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	throw new Error(`timed out waiting for ${what}`);
}

async function main() {
	const checkout = git(process.cwd(), 'rev-parse', '--show-toplevel').trim();
	const mainCheckout = dirname(
		git(checkout, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim()
	);
	if (!existsSync(join(checkout, 'node_modules')))
		fail('run `bun install` in this checkout first.');

	const credentials = loadCredentials(mainCheckout);
	if (await portInUse(PREVIEW_PORT)) {
		fail(
			`port ${String(PREVIEW_PORT)} is in use; stop that server so Playwright builds its own preview.`
		);
	}

	const baseEnv: NodeJS.ProcessEnv = {};
	for (const [name, value] of Object.entries(process.env)) {
		if (!SCRUBBED.test(name)) baseEnv[name] = value;
	}

	const workdir = mkdtempSync(join(tmpdir(), 'budge-e2e-'));
	console.log(`e2e-local: copying ${checkout} into ${workdir}`);
	copyCheckout(checkout, workdir);

	const bun = process.execPath;
	const convexEnv = { ...baseEnv, CONVEX_AGENT_MODE: 'anonymous' };
	const logPath = join(workdir, 'convex.log');
	const log = openSync(logPath, 'w');
	const backend = spawn(bun, ['x', 'convex', 'dev', '--typecheck', 'disable'], {
		cwd: workdir,
		env: convexEnv,
		stdio: ['ignore', log, log],
		detached: true
	});
	const backendExit = exitCode(backend);
	let backendExited = false;
	void backendExit.then(() => {
		backendExited = true;
	});

	let succeeded = false;
	const stopBackend = async () => {
		if (backendExited || backend.pid === undefined) return;
		process.kill(-backend.pid, 'SIGINT');
		const stopped = await Promise.race([
			backendExit.then(() => true),
			new Promise<false>((resolve) => {
				setTimeout(() => {
					resolve(false);
				}, 15_000);
			})
		]);
		if (!stopped) process.kill(-backend.pid, 'SIGKILL');
	};
	const cleanUp = async () => {
		await stopBackend();
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
		let deployment = '';
		let url = '';
		await waitFor('the anonymous backend', 180, async () => {
			if (backendExited) throw new Error('`convex dev` exited early');
			const written = readEnvFile(join(workdir, '.env.local'));
			deployment = written.get('CONVEX_DEPLOYMENT') ?? '';
			url = written.get('PUBLIC_CONVEX_URL') ?? '';
			if (!deployment || !url) return false;
			return fetch(`${url}/version`).then(
				(response) => response.ok,
				() => false
			);
		});
		const { hostname } = new URL(url);
		if (
			!deployment.startsWith('anonymous:anonymous-') ||
			!['127.0.0.1', 'localhost'].includes(hostname) ||
			!existsSync(join(workdir, '.convex', 'local', 'default', 'config.json'))
		) {
			throw new Error('the backend is not an anonymous local deployment in the temp copy');
		}
		console.log(`e2e-local: target: local-anonymous (${deployment.split(':')[1] ?? ''}, ${url})`);

		for (const [name, value] of [
			['CLERK_JWT_ISSUER_DOMAIN', credentials.CLERK_JWT_ISSUER_DOMAIN],
			['BUDGE_OWNER_SUBJECT', credentials.E2E_CLERK_USER_ID]
		] as const) {
			const set = spawn(bun, ['x', 'convex', 'env', 'set', name], {
				cwd: workdir,
				env: convexEnv,
				stdio: ['pipe', 'inherit', 'inherit']
			});
			set.stdin.end(value);
			if ((await exitCode(set)) !== 0) throw new Error(`setting ${name} failed`);
		}
		await waitFor('Convex functions', 120, () => {
			if (backendExited) throw new Error('`convex dev` exited early');
			return readFileSync(logPath, 'utf8').includes('Convex functions ready');
		});

		const seed = spawn(bun, ['x', 'convex', 'run', 'seed:run'], {
			cwd: workdir,
			env: convexEnv,
			stdio: ['ignore', 'inherit', 'inherit']
		});
		if ((await exitCode(seed)) !== 0) throw new Error('seed:run failed');

		const playwright = spawn(bun, ['x', 'playwright', 'test', ...process.argv.slice(2)], {
			cwd: workdir,
			env: {
				...baseEnv,
				PUBLIC_CONVEX_URL: url,
				PUBLIC_CLERK_PUBLISHABLE_KEY: credentials.PUBLIC_CLERK_PUBLISHABLE_KEY,
				CLERK_SECRET_KEY: credentials.CLERK_SECRET_KEY,
				E2E_CLERK_USER_EMAIL: credentials.E2E_CLERK_USER_EMAIL
			},
			stdio: ['inherit', 'pipe', 'pipe']
		});
		redactInto(playwright.stdout, process.stdout, credentials);
		redactInto(playwright.stderr, process.stderr, credentials);
		const code = await exitCode(playwright);
		succeeded = code === 0;
		await cleanUp();
		process.exitCode = code;
	} catch (error) {
		console.error(`e2e-local: ${error instanceof Error ? error.message : String(error)}`);
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
	console.error(`e2e-local: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
} finally {
	restoreCheckoutTypes();
}
