import type { ChildProcess } from 'node:child_process';
import { connect } from 'node:net';

export function exitCode(child: ChildProcess) {
	return new Promise<number>((resolve) => {
		child.once('close', (code, signal) => {
			resolve(code ?? (signal ? 1 : 0));
		});
	});
}

export function sleep(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function waitFor(
	what: string,
	seconds: number,
	ready: () => boolean | Promise<boolean>
) {
	for (let elapsed = 0; elapsed < seconds; elapsed++) {
		if (await ready()) return;
		await sleep(1000);
	}
	throw new Error(`timed out waiting for ${what}`);
}

function probe(host: string, port: number) {
	return new Promise<boolean>((resolve) => {
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
}

export async function portInUse(port: number) {
	const results = await Promise.all([probe('127.0.0.1', port), probe('::1', port)]);
	return results.includes(true);
}

export function processGroupAlive(leader: number) {
	try {
		process.kill(-leader, 0);
		return true;
	} catch {
		return false;
	}
}

export async function stopProcessGroup(leader: number) {
	if (!processGroupAlive(leader)) return;
	process.kill(-leader, 'SIGINT');
	for (let waited = 0; waited < 150 && processGroupAlive(leader); waited++) await sleep(100);
	if (processGroupAlive(leader)) process.kill(-leader, 'SIGKILL');
	for (let waited = 0; waited < 50 && processGroupAlive(leader); waited++) await sleep(100);
}

export function reachable(url: string) {
	return fetch(url, { signal: AbortSignal.timeout(3000) }).then(
		(response) => response.ok,
		() => false
	);
}

const FIRST_UNPRIVILEGED_PORT = 1024;
const UNPRIVILEGED_PORTS = 65536 - FIRST_UNPRIVILEGED_PORT;

export async function freePort(preferred: number, taken: number[] = []) {
	if (!Number.isInteger(preferred) || preferred < FIRST_UNPRIVILEGED_PORT || preferred > 65535)
		throw new Error(`preferred port ${String(preferred)} is not from 1024 to 65535`);
	for (let offset = 0; offset < 100; offset++) {
		const port =
			FIRST_UNPRIVILEGED_PORT +
			((preferred - FIRST_UNPRIVILEGED_PORT + offset) % UNPRIVILEGED_PORTS);
		if (!taken.includes(port) && !(await portInUse(port))) return port;
	}
	throw new Error(`no free port from ${String(preferred)}`);
}
