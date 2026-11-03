import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';

import { app, fakeCheckout, hermeticEnv, removeFakeCheckouts, runApp } from '../test-support';
import { readRunningApp } from './owned';

const children: ChildProcess[] = [];
const checkouts: string[] = [];

afterEach(async () => {
	for (const child of children.splice(0)) {
		if (child.exitCode === null) child.kill('SIGKILL');
	}
	for (const checkout of checkouts.splice(0)) await runApp(['down'], checkout);
	removeFakeCheckouts();
});

function checkout() {
	const path = fakeCheckout();
	checkouts.push(path);
	return path;
}

function launch(cwd: string, down = false) {
	const fixture = new URL('lifecycle.fixture.ts', import.meta.url).pathname;
	const child = spawn(
		'bun',
		['--no-env-file', down ? app : fixture, ...(down ? ['down'] : [cwd])],
		{
			cwd,
			env: hermeticEnv()
		}
	);
	children.push(child);
	let output = '';
	child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
	child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
	const exited = new Promise<number | null>((resolve) => child.once('close', resolve));
	return { child, exited, output: () => output };
}

async function until(condition: () => boolean) {
	await expect.poll(condition, { timeout: 10_000, interval: 50 }).toBe(true);
}

function alive(pid: number) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

test('simultaneous startups leave one instance and one already-up message', async () => {
	const cwd = checkout();
	const first = launch(cwd);
	await until(() => first.output().includes('backend started'));
	const second = launch(cwd);
	await until(() => second.output().includes('waiting for another lifecycle'));
	first.child.stdin.write('continue');
	second.child.stdin.write('continue');
	expect(await first.exited).toBe(0);
	expect(await second.exited).toBe(0);
	expect(first.output()).toContain('app: up at');
	expect(second.output()).toContain('app: already up at');
	const running = readRunningApp(cwd);
	expect(Object.keys(running?.processes ?? {})).toEqual(['backend', 'vite']);
	for (const group of Object.values(running?.processes ?? {})) expect(alive(group.pid)).toBe(true);
});

test('startup recovers after SIGKILL of the lock holder and stops its abandoned backend', async () => {
	const cwd = checkout();
	const first = launch(cwd);
	await until(() => first.output().includes('backend started'));
	const abandoned = readRunningApp(cwd)?.processes.backend;
	expect(abandoned).toBeDefined();
	first.child.kill('SIGKILL');
	await first.exited;
	const next = launch(cwd);
	await until(() => next.output().includes('backend started'));
	expect(alive(abandoned?.pid ?? 0)).toBe(false);
	next.child.stdin.write('continue');
	expect(await next.exited).toBe(0);
	expect(next.output()).toContain('app: up at');
});

test('down during startup waits, then stops both processes and removes the record', async () => {
	const cwd = checkout();
	const up = launch(cwd);
	await until(() => up.output().includes('backend started'));
	const backend = readRunningApp(cwd)?.processes.backend;
	const down = launch(cwd, true);
	await until(() => down.output().includes('waiting for another lifecycle'));
	expect(alive(backend?.pid ?? 0)).toBe(true);
	up.child.stdin.write('continue');
	expect(await up.exited).toBe(0);
	const path = join(cwd, '.local-app', 'running.json');
	if (existsSync(path)) {
		const recorded = JSON.parse(readFileSync(path, 'utf8')) as {
			processes: Record<string, { pid: number }>;
		};
		expect(Object.keys(recorded.processes)).toContain('vite');
	}
	expect(await down.exited).toBe(0);
	expect(down.output()).toContain('app: down.');
	expect(alive(backend?.pid ?? 0)).toBe(false);
	expect(existsSync(path)).toBe(false);
});
