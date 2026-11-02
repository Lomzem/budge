import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { copyCheckout, findCheckout } from '../local/checkout';
import {
	CREDENTIALS,
	developmentInstanceProblems,
	findCredentials,
	missingCredentials,
	type Credentials
} from '../local/credentials';
import { checkLocalAnonymousDeployment } from '../local/deployment';
import { reachable } from '../local/processes';
import { liveApp, readRunningApp } from './owned';
import type { Verb } from './verb';

type Problem = string | undefined;

interface Check {
	label: string;
	problem: () => Problem | Promise<Problem>;
}

async function backendProblem(checkout: string): Promise<Problem> {
	const check = checkLocalAnonymousDeployment(checkout);
	if (!check.local) return `${check.reason}; run \`bun run app up\``;
	const up = await reachable(`${check.deployment.url}/version`);
	return up ? undefined : `${check.deployment.url} does not answer; run \`bun run app up\``;
}

async function viteProblem(checkout: string): Promise<Problem> {
	const recorded = readRunningApp(checkout);
	if (recorded === undefined) return 'the app is not up; run `bun run app up`';
	if (liveApp(checkout) === undefined) {
		return 'the processes .local-app/running.json records are not running; run `bun run app up`';
	}
	return (await reachable(recorded.appUrl))
		? undefined
		: `${recorded.appUrl} does not answer; run \`bun run app up\``;
}

function generatedFiles(dir: string) {
	const generated = join(dir, 'convex', '_generated');
	if (!existsSync(generated)) return new Map<string, string>();
	return new Map(
		readdirSync(generated, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => {
				const path = join(entry.parentPath, entry.name);
				return [path.slice(generated.length + 1), readFileSync(path, 'utf8')] as const;
			})
	);
}

function codegenProblem(checkout: string): Problem {
	const copy = mkdtempSync(join(tmpdir(), 'budge-codegen-'));
	try {
		copyCheckout(checkout, copy);
		const codegen = spawnSync(process.execPath, ['run', 'codegen'], { cwd: copy, stdio: 'ignore' });
		if (codegen.status !== 0) return '`bun run codegen` failed';
		const current = generatedFiles(checkout);
		const fresh = generatedFiles(copy);
		const stale = [...new Set([...current.keys(), ...fresh.keys()])].filter(
			(file) => current.get(file) !== fresh.get(file)
		);
		return stale.length === 0 ? undefined : `stale ${stale.join(', ')}; run \`bun run codegen\``;
	} finally {
		rmSync(copy, { recursive: true, force: true });
	}
}

function usableCredentials(found: Partial<Credentials>): Credentials | undefined {
	if (missingCredentials(found).length > 0) return undefined;
	const complete = found as Credentials;
	return developmentInstanceProblems(complete).length === 0 ? complete : undefined;
}

async function testUserProblem(found: Partial<Credentials>): Promise<Problem> {
	const credentials = usableCredentials(found);
	if (credentials === undefined) return 'needs every Clerk variable, with development keys';
	const response = await fetch(
		`https://api.clerk.com/v1/users/${encodeURIComponent(credentials.E2E_CLERK_USER_ID)}`,
		{
			headers: { Authorization: `Bearer ${credentials.CLERK_SECRET_KEY}` },
			signal: AbortSignal.timeout(10_000)
		}
	).catch(() => undefined);
	if (response === undefined) return 'the Clerk API did not answer';
	if (!response.ok)
		return `the Clerk API answered ${String(response.status)} for E2E_CLERK_USER_ID`;
	const user = (await response.json()) as { email_addresses?: { email_address?: string }[] };
	const emails = (user.email_addresses ?? []).map((email) => email.email_address);
	return emails.includes(credentials.E2E_CLERK_USER_EMAIL)
		? undefined
		: 'E2E_CLERK_USER_EMAIL is not an address of E2E_CLERK_USER_ID';
}

function checks(checkout: string, mainCheckout: string): Check[] {
	const found = findCredentials(mainCheckout);
	return [
		...CREDENTIALS.map((name) => ({
			label: `${name} is set`,
			problem: () =>
				found[name] === undefined
					? "missing from the environment and the main checkout's .env.local"
					: undefined
		})),
		{
			label: 'Clerk variables belong to one development instance',
			problem: () => {
				const credentials = usableCredentials(found);
				if (missingCredentials(found).length > 0) return 'some are missing';
				return credentials === undefined
					? developmentInstanceProblems(found as Credentials).join(' ')
					: undefined;
			}
		},
		{ label: 'local Convex backend reachable', problem: () => backendProblem(checkout) },
		{ label: 'Vite reachable', problem: () => viteProblem(checkout) },
		{ label: 'convex/_generated is fresh', problem: () => codegenProblem(checkout) },
		{ label: 'Clerk test user available', problem: () => testUserProblem(found) }
	];
}

export const doctor: Verb = {
	usage: 'bun run app doctor',
	summary: 'Check the local app is ready: backend, Vite, env names, codegen, Clerk test user.',
	details:
		'Prints ok or FAIL per check and exits non-zero on any failure. Never prints variable values.',
	run: async () => {
		const { checkout, mainCheckout } = findCheckout();
		let failed = 0;
		for (const { label, problem } of checks(checkout, mainCheckout)) {
			const found = await problem();
			if (found === undefined) console.log(`ok    ${label}`);
			else console.log(`FAIL  ${label}: ${found}`);
			if (found !== undefined) failed++;
		}
		if (failed > 0) process.exitCode = 1;
	}
};
