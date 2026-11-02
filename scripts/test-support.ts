import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const app = new URL('app.ts', import.meta.url).pathname;

const DEPLOYMENT_CLERK_AND_GIT_SETTINGS =
	/^(CONVEX_|PUBLIC_CONVEX_|CLERK_|PUBLIC_CLERK_|E2E_|GIT_)/;

export function hermeticEnv(): NodeJS.ProcessEnv {
	return Object.fromEntries(
		Object.entries(process.env).filter(([name]) => !DEPLOYMENT_CLERK_AND_GIT_SETTINGS.test(name))
	);
}

const checkouts: string[] = [];

export function fakeCheckout(files: Record<string, string> = {}) {
	const checkout = mkdtempSync(join(tmpdir(), 'budge-app-test-'));
	checkouts.push(checkout);
	execFileSync('git', ['init', '--quiet'], { cwd: checkout, env: hermeticEnv() });
	const withPackage = {
		'package.json': '{ "scripts": { "sync": "true" }, "dependencies": { "convex": "1.48.0" } }',
		...files
	};
	for (const [path, content] of Object.entries(withPackage)) {
		mkdirSync(dirname(join(checkout, path)), { recursive: true });
		writeFileSync(join(checkout, path), content);
	}
	return checkout;
}

export function removeFakeCheckouts() {
	for (const checkout of checkouts.splice(0)) rmSync(checkout, { recursive: true, force: true });
}

export function runApp(args: string[], cwd = fakeCheckout(), env: NodeJS.ProcessEnv = {}) {
	const child = spawn('bun', ['--no-env-file', app, ...args], {
		cwd,
		env: { ...hermeticEnv(), ...env }
	});
	let stdout = '';
	let stderr = '';
	child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
	child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
	return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
		child.once('close', (code) => {
			resolve({ code, stdout, stderr });
		});
	});
}
