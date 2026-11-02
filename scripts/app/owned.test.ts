import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';

import { fakeCheckout, hermeticEnv, removeFakeCheckouts, runApp } from '../test-support';

const fixture = new URL('owned.fixture.ts', import.meta.url).pathname;
const children: ChildProcess[] = [];
const groups: number[] = [];

afterEach(() => {
	const leaders = [...children.splice(0).map(({ pid }) => pid), ...groups.splice(0)];
	for (const leader of leaders) {
		if (leader !== undefined && groupAlive(leader)) process.kill(-leader, 'SIGKILL');
	}
	removeFakeCheckouts();
});

function groupAlive(leader: number) {
	try {
		process.kill(-leader, 0);
		return true;
	} catch {
		return false;
	}
}

async function eventually(condition: () => boolean, seconds = 20) {
	for (let waited = 0; waited < seconds * 10 && !condition(); waited++) {
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	return condition();
}

function runningPath(checkout: string) {
	return join(checkout, '.local-app', 'running.json');
}

function recordedBackendPid(checkout: string) {
	const running = JSON.parse(readFileSync(runningPath(checkout), 'utf8')) as {
		processes: { backend: { pid: number } };
	};
	const pid = running.processes.backend.pid;
	groups.push(pid);
	return pid;
}

function childrenOf(pid: number) {
	try {
		return execFileSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' })
			.split('\n')
			.filter(Boolean)
			.map(Number);
	} catch {
		return [];
	}
}

function startFixture(checkout: string, command: string[] = []) {
	const child = spawn('bun', ['--no-env-file', fixture, checkout, ...command], {
		env: hermeticEnv(),
		stdio: ['ignore', 'pipe', 'inherit']
	});
	children.push(child);
	return new Promise<ChildProcess>((resolve, reject) => {
		child.stdout.on('data', (chunk: Buffer) => {
			if (chunk.toString().includes('started')) resolve(child);
		});
		child.once('close', () => {
			reject(new Error('the fixture exited before it started its process'));
		});
	});
}

function stranger() {
	const child = spawn('sleep', ['300'], { env: hermeticEnv(), detached: true, stdio: 'ignore' });
	children.push(child);
	if (child.pid === undefined) throw new Error('sleep did not start');
	return child.pid;
}

function recordStranger(checkout: string, record: object) {
	mkdirSync(join(checkout, '.local-app'), { recursive: true });
	writeFileSync(runningPath(checkout), JSON.stringify(record));
}

const URLS = { appUrl: 'http://127.0.0.1:5999', backendUrl: 'http://127.0.0.1:3999' };

const INVENTED_IDENTITY = { started: 'Thu Jan  1 00:00:00 2026', command: 'bun redacted-log.ts' };

const STRANGER_RECORDS: Record<string, (pid: number) => object> = {
	'an invented identity': (pid) => ({
		...URLS,
		processes: {
			backend: { pid, ...INVENTED_IDENTITY, child: { pid, ...INVENTED_IDENTITY } },
			vite: { pid, ...INVENTED_IDENTITY, child: { pid, ...INVENTED_IDENTITY } }
		}
	}),
	'the format without identities': (pid) => ({ ...URLS, backendPid: pid, vitePid: pid })
};

test('a start interrupted by SIGINT stops what it started and forgets it', async () => {
	const checkout = fakeCheckout();
	const starter = await startFixture(checkout);
	const pid = recordedBackendPid(checkout);
	expect(groupAlive(pid)).toBe(true);

	const exited = new Promise((resolve) => starter.once('close', resolve));
	starter.kill('SIGINT');

	expect(await exited).toBe(130);
	expect(groupAlive(pid)).toBe(false);
	expect(existsSync(runningPath(checkout))).toBe(false);
});

test('down stops what a killed start left behind', async () => {
	const checkout = fakeCheckout();
	const starter = await startFixture(checkout);
	const pid = recordedBackendPid(checkout);
	const exited = new Promise((resolve) => starter.once('close', resolve));
	starter.kill('SIGKILL');
	await exited;
	expect(groupAlive(pid)).toBe(true);

	const result = await runApp(['down'], checkout);

	expect(result.code).toBe(0);
	expect(await eventually(() => !groupAlive(pid))).toBe(true);
	expect(existsSync(runningPath(checkout))).toBe(false);
});

async function abandon(starter: ChildProcess) {
	const exited = new Promise((resolve) => starter.once('close', resolve));
	starter.kill('SIGKILL');
	await exited;
}

test('down stops the command a killed wrapper left behind', async () => {
	const checkout = fakeCheckout();
	const starter = await startFixture(checkout);
	const wrapper = recordedBackendPid(checkout);
	expect(await eventually(() => childrenOf(wrapper).length === 1)).toBe(true);
	await abandon(starter);
	process.kill(wrapper, 'SIGKILL');
	expect(await eventually(() => childrenOf(wrapper).length === 0)).toBe(true);
	expect(groupAlive(wrapper)).toBe(true);

	const result = await runApp(['down'], checkout);

	expect(result.code).toBe(0);
	expect(await eventually(() => !groupAlive(wrapper))).toBe(true);
	expect(existsSync(runningPath(checkout))).toBe(false);
});

test('down keeps the record and fails when it cannot verify what survives', async () => {
	const checkout = fakeCheckout();
	const starter = await startFixture(checkout, ['sh', '-c', 'sleep 300 & wait']);
	const wrapper = recordedBackendPid(checkout);
	expect(await eventually(() => childrenOf(wrapper).length === 1)).toBe(true);
	const [shell = 0] = childrenOf(wrapper);
	expect(await eventually(() => childrenOf(shell).length === 1)).toBe(true);
	const [survivor] = childrenOf(shell);
	await abandon(starter);
	process.kill(wrapper, 'SIGKILL');
	process.kill(shell, 'SIGKILL');

	const result = await runApp(['down'], checkout);

	expect(result.code).not.toBe(0);
	expect(result.stderr).toContain(`could not verify 1 survivor: pid ${String(survivor)}`);
	expect(groupAlive(wrapper)).toBe(true);
	expect(existsSync(runningPath(checkout))).toBe(true);
});

for (const [shape, record] of Object.entries(STRANGER_RECORDS)) {
	test(`down leaves alone a process it did not start, recorded with ${shape}`, async () => {
		const checkout = fakeCheckout();
		const pid = stranger();
		recordStranger(checkout, record(pid));

		const result = await runApp(['down'], checkout);

		expect(result.code).toBe(0);
		expect(groupAlive(pid)).toBe(true);
		expect(existsSync(runningPath(checkout))).toBe(false);
	});

	test(`up does not count a process it did not start as up, recorded with ${shape}`, async () => {
		const checkout = fakeCheckout({ 'node_modules/.keep': '' });
		const pid = stranger();
		recordStranger(checkout, record(pid));

		const result = await runApp(['up'], checkout);

		expect(result.stdout).not.toMatch(/already up/);
		expect(groupAlive(pid)).toBe(true);
	});
}
