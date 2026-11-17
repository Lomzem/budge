import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { setup } from './access';

const startedIn = process.cwd();
let home = '';
let checkout = '';

beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), 'budge-agent-home-'));
	checkout = mkdtempSync(join(tmpdir(), 'budge-agent-checkout-'));
	execFileSync('git', ['init', '-q'], { cwd: checkout });
	process.chdir(checkout);
	vi.stubEnv('HOME', home);
	vi.stubEnv('BUDGE_AGENT_CONFIG', join(home, 'agent.json'));
});

afterEach(() => {
	process.chdir(startedIn);
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	rmSync(home, { recursive: true, force: true });
	rmSync(checkout, { recursive: true, force: true });
});

function loggedIn() {
	mkdirSync(join(home, '.convex'));
	writeFileSync(
		join(home, '.convex', 'config.json'),
		JSON.stringify({ accessToken: 'test-access-token' })
	);
}

type Answer = number | string | object;

function convexAnswers(answers: Record<string, Answer>) {
	vi.stubGlobal('fetch', (url: string) => {
		const answer = answers[new URL(url).pathname];
		if (answer === undefined) return Promise.resolve(new Response('', { status: 404 }));
		if (typeof answer === 'number') return Promise.resolve(new Response('', { status: answer }));
		if (typeof answer === 'string') return Promise.resolve(new Response(answer, { status: 200 }));
		return Promise.resolve(Response.json(answer));
	});
}

const teams = (...slugs: string[]) => slugs.map((slug) => ({ slug }));
const budgeIn = (team: string) => ({
	teamSlug: team,
	slug: 'budge',
	prodDeploymentName: `${team}-animal-123`
});

describe('setup --prod from a checkout with no Convex cloud project', () => {
	test.each<{ situation: string; login: boolean; answers: Record<string, Answer>; says: RegExp }>([
		{
			situation: 'without a Convex login, shows how to log in',
			login: false,
			answers: {},
			says: /bunx convex login/
		},
		{
			situation: 'when no team has a budge project, shows how to name production',
			login: true,
			answers: { '/api/teams': teams('mine') },
			says: /none of your Convex teams has a budge project[\s\S]*setup --deployment <name>/
		},
		{
			situation: 'when one team lookup fails, refuses rather than pick another team',
			login: true,
			answers: {
				'/api/teams': teams('mine', 'flaky'),
				'/v1/teams/mine/projects/budge': budgeIn('mine'),
				'/v1/teams/flaky/projects/budge': 503
			},
			says: /Convex answered HTTP 503/
		},
		{
			situation: 'when two teams have budge production, asks which one',
			login: true,
			answers: {
				'/api/teams': teams('mine', 'work'),
				'/v1/teams/mine/projects/budge': budgeIn('mine'),
				'/v1/teams/work/projects/budge': budgeIn('work')
			},
			says: /Pick one:\n {2}bun run agent setup --deployment mine:budge:prod\n {2}bun run agent setup --deployment work:budge:prod/
		},
		{
			situation: 'when Convex answers with something that is not JSON, says it cannot read it',
			login: true,
			answers: { '/api/teams': '<html>maintenance</html>' },
			says: /shape setup doesn't recognize/
		}
	])('$situation, and changes nothing', async ({ login, answers, says }) => {
		if (login) loggedIn();
		convexAnswers(answers);

		const refused = setup(['--prod', '--no-register']);

		await expect(refused).rejects.toThrow(says);
		await expect(refused).rejects.toThrow(/Nothing changed/);
		expect(existsSync(join(home, 'agent.json'))).toBe(false);
	});
});
