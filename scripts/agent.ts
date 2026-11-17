import { revoke, rotate, setup } from './agent/access';
import { serveAgentTools } from './agent/serve';
import { redact } from './local/redaction';

interface AgentVerb {
	summary: string;
	run: (args: string[]) => Promise<void> | void;
}

const VERBS: Record<string, AgentVerb> = {
	setup: {
		summary:
			'turn agent access on: new Agent Key, register the budge tools with Claude Code and Codex. [--deployment <name> | --prod] [--no-register]',
		run: setup
	},
	rotate: { summary: 'replace the Agent Key; the old key stops working', run: rotate },
	revoke: { summary: 'turn agent access off and delete the local Agent Key', run: revoke },
	serve: {
		summary: 'run the budge tools over stdio (Claude Code and Codex start this)',
		run: serveAgentTools
	}
};

const [name, ...args] = process.argv.slice(2);
const verb = name === undefined ? undefined : VERBS[name];

if (verb === undefined) {
	console.error('usage: bun run agent <verb>\n');
	for (const [verbName, { summary }] of Object.entries(VERBS))
		console.error(`  ${verbName.padEnd(6)}  ${summary}`);
	process.exitCode = name === undefined || name === '--help' ? 0 : 1;
} else {
	try {
		await verb.run(args);
	} catch (error) {
		console.error(`agent: ${redact(error instanceof Error ? error.message : String(error))}`);
		process.exitCode = 1;
	}
}
