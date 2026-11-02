import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';

import { redact, treatAsSecret } from './redaction';

interface Options {
	log: string;
	secretEnv: string[];
	secretConfig: string | undefined;
	command: string[];
}

function parse(argv: string[]): Options {
	const separator = argv.indexOf('--');
	const flags = new Map<string, string>();
	const head = separator === -1 ? argv : argv.slice(0, separator);
	for (let index = 0; index + 1 < head.length; index += 2) {
		flags.set(head[index] ?? '', head[index + 1] ?? '');
	}
	const log = flags.get('--log');
	const command = separator === -1 ? [] : argv.slice(separator + 1);
	if (log === undefined || command.length === 0) {
		throw new Error(
			'usage: redacted-log --log <path> [--secret-env NAME,…] [--secret-config <json>] -- <command> …'
		);
	}
	return {
		log,
		secretEnv: (flags.get('--secret-env') ?? '').split(',').filter(Boolean),
		secretConfig: flags.get('--secret-config'),
		command
	};
}

function secretsFromConfig(path: string | undefined) {
	if (path === undefined || !existsSync(path)) return false;
	const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
	treatAsSecret(
		[config.adminKey, config.instanceSecret].filter((value) => typeof value === 'string')
	);
	return true;
}

const options = parse(process.argv.slice(2));
treatAsSecret(options.secretEnv.map((name) => process.env[name] ?? ''));
let configRead = secretsFromConfig(options.secretConfig);

rmSync(options.log, { force: true });
const log = createWriteStream(options.log, { flags: 'w', mode: 0o600 });
const [command = '', ...args] = options.command;
const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

function copy(source: Readable) {
	createInterface({ input: source, crlfDelay: Infinity }).on('line', (line) => {
		if (!configRead) configRead = secretsFromConfig(options.secretConfig);
		log.write(`${redact(line)}\n`);
	});
}
copy(child.stdout);
copy(child.stderr);

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, () => undefined);

child.once('close', (code, signal) => {
	log.end(() => process.exit(code ?? (signal ? 1 : 0)));
});
child.once('error', (error) => {
	log.end(`redacted-log: ${redact(error.message)}\n`, () => process.exit(1));
});
