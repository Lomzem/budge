import { spawn } from 'node:child_process';

const wrapper = new URL('redacted-log.ts', import.meta.url).pathname;

export interface LoggedCommand {
	command: string[];
	cwd: string;
	env: NodeJS.ProcessEnv;
	logPath: string;
	secretEnv?: string[];
	secretConfig?: string;
}

export function spawnLogged({
	command,
	cwd,
	env,
	logPath,
	secretEnv = [],
	secretConfig
}: LoggedCommand) {
	const redaction = [
		...(secretEnv.length > 0 ? ['--secret-env', secretEnv.join(',')] : []),
		...(secretConfig === undefined ? [] : ['--secret-config', secretConfig])
	];
	return spawn(
		process.execPath,
		['--no-env-file', wrapper, '--log', logPath, ...redaction, '--', ...command],
		{ cwd, env, stdio: 'ignore', detached: true }
	);
}
