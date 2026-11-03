import { spawn } from 'node:child_process';

import { exitCode, portInUse } from './processes';

const port = Number(process.argv[2]);
const collision = "This run's preview port was claimed; allocate a new run-owned port.";
if (await portInUse(port)) throw new Error(collision);
const child = spawn(
	'bun',
	['run', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
	{
		stdio: ['inherit', 'inherit', 'pipe']
	}
);
child.stderr.on('data', (chunk: Buffer) => {
	const message = chunk.toString();
	process.stderr.write(message.includes('already in use') ? `${collision}\n` : message);
});
process.exitCode = await exitCode(child);
