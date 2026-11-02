import { execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { processGroupAlive, sleep, stopProcessGroup } from '../local/processes';
import { redact } from '../local/redaction';
import { stateDir } from './state';

export type Role = 'backend' | 'vite';

const ROLES: Role[] = ['backend', 'vite'];

export interface OwnedProcess {
	pid: number;
	started: string;
	command: string;
}

export interface OwnedGroup extends OwnedProcess {
	child: OwnedProcess;
}

export interface AppUrls {
	appUrl: string;
	backendUrl: string;
}

export interface RunningApp extends AppUrls {
	processes: Partial<Record<Role, OwnedGroup>>;
}

const SIGNAL_EXIT_CODES = [
	['SIGINT', 130],
	['SIGTERM', 143],
	['SIGHUP', 129]
] as const;

const launched = new Set<number>();

function runningAppPath(checkout: string) {
	return join(checkout, '.local-app', 'running.json');
}

function ps(pid: number, field: string) {
	return execFileSync('ps', ['-ww', '-o', `${field}=`, '-p', String(pid)], {
		encoding: 'utf8',
		env: { ...process.env, LC_ALL: 'C' },
		stdio: ['ignore', 'pipe', 'ignore']
	}).trim();
}

function identify(pid: number): OwnedProcess | undefined {
	try {
		return { pid, started: ps(pid, 'lstart'), command: ps(pid, 'args') };
	} catch {
		return undefined;
	}
}

function pids(lines: string) {
	return lines.split('\n').filter(Boolean).map(Number);
}

function pgrep(flag: '-P' | '-g', pid: number) {
	try {
		return pids(execFileSync('pgrep', [flag, String(pid)], { encoding: 'utf8' }));
	} catch {
		return [];
	}
}

function isOwnedProcess(value: unknown): value is OwnedProcess {
	const candidate = value as Partial<OwnedProcess> | undefined;
	return (
		typeof candidate?.pid === 'number' &&
		typeof candidate.started === 'string' &&
		typeof candidate.command === 'string'
	);
}

function isOwnedGroup(value: unknown): value is OwnedGroup {
	return isOwnedProcess(value) && isOwnedProcess((value as Partial<OwnedGroup>).child);
}

export function owns(recorded: OwnedProcess) {
	const now = identify(recorded.pid);
	return now?.started === recorded.started && now.command === recorded.command;
}

export function readRunningApp(checkout: string): RunningApp | undefined {
	const path = runningAppPath(checkout);
	if (!existsSync(path)) return undefined;
	const raw = JSON.parse(readFileSync(path, 'utf8')) as {
		appUrl?: unknown;
		backendUrl?: unknown;
		processes?: Partial<Record<Role, unknown>>;
	};
	const processes: RunningApp['processes'] = {};
	for (const role of ROLES) {
		const recorded = raw.processes?.[role];
		if (isOwnedGroup(recorded)) processes[role] = recorded;
	}
	return {
		appUrl: typeof raw.appUrl === 'string' ? raw.appUrl : '',
		backendUrl: typeof raw.backendUrl === 'string' ? raw.backendUrl : '',
		processes
	};
}

function writeRunningApp(checkout: string, app: RunningApp) {
	const path = runningAppPath(checkout);
	stateDir(checkout);
	writeFileSync(`${path}.tmp`, `${JSON.stringify(app, null, '\t')}\n`, { mode: 0o600 });
	renameSync(`${path}.tmp`, path);
}

export function liveApp(checkout: string): RunningApp | undefined {
	const running = readRunningApp(checkout);
	if (running === undefined) return undefined;
	const allOwned = ROLES.every((role) => {
		const recorded = running.processes[role];
		return recorded !== undefined && owns(recorded);
	});
	return allOwned ? running : undefined;
}

function spawned(child: ChildProcess) {
	return new Promise<void>((resolve, reject) => {
		child.once('spawn', resolve);
		child.once('error', reject);
	});
}

function wrappedCommand(wrapper: OwnedProcess) {
	const [pid] = pgrep('-P', wrapper.pid);
	const child = pid === undefined ? undefined : identify(pid);
	return child?.command === wrapper.command ? undefined : child;
}

async function identifyGroup(leader: number): Promise<OwnedGroup | undefined> {
	for (let waited = 0; waited < 200; waited++) {
		const wrapper = identify(leader);
		if (wrapper === undefined) return undefined;
		const child = wrappedCommand(wrapper);
		if (child !== undefined) return { ...wrapper, child };
		await sleep(50);
	}
	return undefined;
}

export async function startOwned(
	checkout: string,
	urls: AppUrls,
	role: Role,
	spawnProcess: () => ChildProcess
) {
	stateDir(checkout);
	const child = spawnProcess();
	if (child.pid !== undefined) launched.add(child.pid);
	await spawned(child);
	const group = child.pid === undefined ? undefined : await identifyGroup(child.pid);
	if (group === undefined) throw new Error(`the ${role} process did not start`);
	const processes = readRunningApp(checkout)?.processes ?? {};
	writeRunningApp(checkout, { ...urls, processes: { ...processes, [role]: group } });
	return child;
}

function ownsGroup(recorded: OwnedGroup) {
	return owns(recorded) || owns(recorded.child);
}

function unverifiedSurvivors(recorded: OwnedGroup) {
	return identify(recorded.pid) === undefined ? pgrep('-g', recorded.pid) : [];
}

function survivorsMessage(survivors: number[]) {
	const noun = survivors.length === 1 ? 'survivor' : 'survivors';
	return (
		`could not verify ${String(survivors.length)} ${noun}: pid ${survivors.join(', ')}; ` +
		'kept .local-app/running.json. Stop them, then run `bun run app down` again.'
	);
}

export async function stopRecordedApp(checkout: string) {
	const recorded = Object.values(readRunningApp(checkout)?.processes ?? {});
	const ours = recorded.filter(ownsGroup);
	const leaders = [...new Set([...ours.map(({ pid }) => pid), ...launched])];
	await Promise.all(leaders.map(stopProcessGroup));
	const survivors = leaders.filter(processGroupAlive);
	if (survivors.length > 0) {
		throw new Error(
			`process groups ${survivors.join(', ')} did not stop; kept .local-app/running.json`
		);
	}
	const unverified = recorded.filter((group) => !ours.includes(group)).flatMap(unverifiedSurvivors);
	if (unverified.length > 0) throw new Error(survivorsMessage(unverified));
	launched.clear();
	rmSync(runningAppPath(checkout), { force: true });
}

export function stopOnInterrupt(checkout: string) {
	let stopping = false;
	const handlers = SIGNAL_EXIT_CODES.map(([signal, code]) => {
		const handler = () => {
			if (stopping) return;
			stopping = true;
			console.error(`app: ${signal}; stopping what this start launched…`);
			stopRecordedApp(checkout).then(
				() => process.exit(code),
				(error: unknown) => {
					console.error(`app: ${redact(error instanceof Error ? error.message : String(error))}`);
					process.exit(code);
				}
			);
		};
		process.on(signal, handler);
		return [signal, handler] as const;
	});
	return () => {
		for (const [signal, handler] of handlers) process.off(signal, handler);
		launched.clear();
	};
}
