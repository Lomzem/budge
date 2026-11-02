import { doctor } from './app/doctor';
import { down } from './app/down';
import { login } from './app/login';
import { reset } from './app/reset';
import { seed } from './app/seed';
import { up } from './app/up';
import type { Verb } from './app/verb';
import { redact } from './local/redaction';

const VERBS: Record<string, Verb> = { doctor, up, down, login, reset, seed };

function listVerbs() {
	console.log('usage: bun run app <verb> [--help]\n');
	const width = Math.max(...Object.keys(VERBS).map((name) => name.length));
	for (const [name, verb] of Object.entries(VERBS)) {
		console.log(`  ${name.padEnd(width)}  ${verb.summary}`);
	}
}

function describe(verb: Verb) {
	console.log(`usage: ${verb.usage}\n\n${verb.summary}\n${verb.details}`);
}

const [name, ...args] = process.argv.slice(2);
const verb = name === undefined ? undefined : VERBS[name];

if (name === undefined || name === '--help' || name === '-h') {
	listVerbs();
} else if (verb === undefined) {
	console.error(`app: unknown verb ${name}.\n`);
	listVerbs();
	process.exitCode = 1;
} else if (args.includes('--help') || args.includes('-h')) {
	describe(verb);
} else {
	try {
		await verb.run(args);
	} catch (error) {
		console.error(`app: ${redact(error instanceof Error ? error.message : String(error))}`);
		process.exitCode = 1;
	}
}
