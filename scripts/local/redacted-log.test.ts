import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const wrapper = new URL('redacted-log.ts', import.meta.url).pathname;
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function run(args: string[], env: NodeJS.ProcessEnv) {
	const child = spawn('bun', ['--no-env-file', wrapper, ...args], {
		env: { PATH: process.env.PATH, ...env },
		stdio: 'ignore'
	});
	return new Promise<number | null>((resolve) => child.once('close', resolve));
}

test("replaces the log with the child's stdout and stderr, secrets redacted, readable only by its owner", async () => {
	const dir = mkdtempSync(join(tmpdir(), 'budge-redacted-log-'));
	dirs.push(dir);
	const log = join(dir, 'child.log');
	writeFileSync(log, 'a line from the previous run\n', { mode: 0o644 });
	const config = join(dir, 'config.json');
	writeFileSync(config, JSON.stringify({ adminKey: 'anonymous-agent|invented-admin-key' }));
	const script = [
		'echo "secret $INVENTED_SECRET"',
		'echo "clerk sess_invented"',
		'echo "admin anonymous-agent|invented-admin-key" >&2',
		'echo plain',
		'exit 3'
	].join('; ');

	const code = await run(
		[
			'--log',
			log,
			'--secret-env',
			'INVENTED_SECRET',
			'--secret-config',
			config,
			'--',
			'sh',
			'-c',
			script
		],
		{ INVENTED_SECRET: 'invented-secret-value' }
	);

	expect(code).toBe(3);
	expect(readFileSync(log, 'utf8').trim().split('\n').sort()).toEqual([
		'admin <redacted>',
		'clerk <redacted>',
		'plain',
		'secret <redacted>'
	]);
	expect(statSync(log).mode & 0o777).toBe(0o600);
});
