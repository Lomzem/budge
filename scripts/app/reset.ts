import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runConvex } from '../local/backend';
import { findCheckout } from '../local/checkout';
import { requireLocalAnonymousDeployment, type LocalDeployment } from '../local/deployment';
import { reachable } from '../local/processes';
import { stateDir } from './state';
import type { Verb } from './verb';

export async function emptyEveryTable(dir: string, deployment: LocalDeployment) {
	if (!(await reachable(`${deployment.url}/version`))) {
		throw new Error('the local backend is not running. Run `bun run app up` first.');
	}
	const noRows = join(stateDir(dir), 'no-rows.jsonl');
	writeFileSync(noRows, '');
	const code = await runConvex(deployment, dir, [
		'import',
		'--replace-all',
		'--yes',
		'--table',
		'settings',
		noRows
	]);
	if (code !== 0) throw new Error('emptying the local backend failed.');
}

export const reset: Verb = {
	usage: 'bun run app reset',
	summary: 'Empty every table on the local backend.',
	details:
		"Refuses unless this checkout's .env.local names a local anonymous deployment (the one `up` starts).",
	run: async () => {
		const { checkout } = findCheckout();
		await emptyEveryTable(checkout, requireLocalAnonymousDeployment(checkout, 'reset'));
		console.log('app: emptied every table on the local backend.');
	}
};
