import { runConvex } from '../local/backend';
import { findCheckout } from '../local/checkout';
import { requireLocalAnonymousDeployment } from '../local/deployment';
import { FIXTURES, findFixture } from './fixtures';
import { emptyEveryTable } from './reset';
import type { Verb } from './verb';

function listFixtures() {
	const width = Math.max(...FIXTURES.map((fixture) => fixture.name.length));
	for (const fixture of FIXTURES) console.log(`${fixture.name.padEnd(width)}  ${fixture.summary}`);
}

export const seed: Verb = {
	usage: 'bun run app seed <fixture> | bun run app seed --list',
	summary: 'Reset the local backend, then load a named fixture of invented data.',
	details: [
		'--list  name every fixture.',
		"Refuses unless this checkout's .env.local names a local anonymous deployment (the one `up` starts)."
	].join('\n'),
	run: async ([name]) => {
		if (name === '--list') {
			listFixtures();
			return;
		}
		requireLocalAnonymousDeployment(findCheckout().checkout, 'seed');
		const fixture = name === undefined ? undefined : findFixture(name);
		if (fixture === undefined) {
			throw new Error(
				`name a fixture: ${FIXTURES.map((known) => known.name).join(', ')}. See \`bun run app seed --list\`.`
			);
		}
		const { checkout, deployment } = await emptyEveryTable('seed');
		for (const convexFunction of fixture.convexFunctionsToRun) {
			if ((await runConvex(deployment, checkout, ['run', convexFunction])) !== 0) {
				throw new Error(`${convexFunction} failed.`);
			}
		}
		console.log(`app: loaded ${fixture.name}.`);
	}
};
