import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { portInUse } from './processes';

function launch() {
	const cwd = mkdtempSync(join(tmpdir(), 'budge-ports-'));
	const child = spawn(
		'bun',
		['--no-env-file', new URL('e2e-ports.fixture.ts', import.meta.url).pathname],
		{ cwd }
	);
	const exited = new Promise((resolve) => child.once('close', resolve));
	const ready = new Promise<number[]>((resolve, reject) => {
		child.once('error', reject);
		child.once('exit', (code) => {
			reject(new Error(`binding subprocess exited ${String(code)}`));
		});
		child.stdout.once('data', (chunk: Buffer) => {
			resolve(Object.values(JSON.parse(chunk.toString()) as Record<string, number>));
		});
	});
	return { cwd, child, exited, ready };
}

test('concurrent E2E runs bind distinct frontend and backend ports and release only their own', async () => {
	const first = launch();
	const second = launch();
	try {
		const [a, b] = await Promise.all([first.ready, second.ready]);
		expect(new Set([...a, ...b]).size).toBe(6);
		expect(await Promise.all([...a, ...b].map(portInUse))).toEqual(Array(6).fill(true));
		first.child.stdin.end('stop');
		expect(await first.exited).toBe(0);
		expect(await Promise.all(a.map(portInUse))).toEqual([false, false, false]);
		expect(await Promise.all(b.map(portInUse))).toEqual([true, true, true]);
		second.child.stdin.end('stop');
		expect(await second.exited).toBe(0);
		expect(await Promise.all(b.map(portInUse))).toEqual([false, false, false]);
	} finally {
		for (const run of [first, second]) {
			if (run.child.exitCode === null) run.child.kill('SIGKILL');
			await run.exited;
			rmSync(run.cwd, { recursive: true, force: true });
		}
	}
});
