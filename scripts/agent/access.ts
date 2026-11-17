import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { convexCli } from '../local/backend';
import { findCheckout } from '../local/checkout';
import { deploymentEnvOf, deploymentOverrides } from '../local/deployment';
import { inheritedEnvWithoutDeploymentSettings } from '../local/env-file';
import { treatAsSecret } from '../local/redaction';
import {
	agentCommand,
	agentConfigPath,
	readAgentConfig,
	removeAgentConfig,
	writeAgentConfig,
	type AgentConfig
} from './config';

const FINGERPRINT_VARIABLE = 'BUDGE_AGENT_KEY_SHA256';
const SERVER_NAME = 'budge';
const CONVEX_PROJECT = 'budge';

const UNLINKED = "This checkout isn't linked to a Convex cloud project";
const LOG_IN = 'Log in, then run this again:\n  bunx convex login\n  bun run agent setup --prod';
const FIND_PRODUCTION = [
	'Let setup find production through your Convex login:',
	'  bun run agent setup --prod'
].join('\n');
const NAME_PRODUCTION = [
	`Or name it yourself: open https://dashboard.convex.dev, choose the ${CONVEX_PROJECT} project, and switch to Production. The deployment name is in the page's URL, like happy-animal-123:`,
	'  bun run agent setup --deployment <name>'
].join('\n');

function nothingChanged(problem: string, ...remedies: string[]) {
	return new Error([`${problem} Nothing changed.`, ...remedies].join('\n\n'));
}

function targetOf(args: string[]) {
	if (args.includes('--prod')) return ['--prod'];
	const index = args.indexOf('--deployment');
	if (index === -1) return [];
	const name = args[index + 1];
	if (name === undefined || name.startsWith('--')) {
		throw new Error('--deployment needs a deployment name, e.g. --deployment local.');
	}
	return ['--deployment', name];
}

function describeTarget(target: string[]) {
	if (target[0] === '--prod') return 'the production deployment';
	if (target[1]?.endsWith(':prod')) return `the production deployment ${target[1]}`;
	return target[1] === undefined ? "this checkout's dev deployment" : `deployment ${target[1]}`;
}

function convex(args: string[], input?: string) {
	const result = spawnSync(process.execPath, ['--no-env-file', convexCli, ...args], {
		cwd: findCheckout().checkout,
		env: inheritedEnvWithoutDeploymentSettings(),
		encoding: 'utf8',
		input,
		stdio: ['pipe', 'pipe', 'pipe']
	});
	if (result.status !== 0) {
		throw new Error(`convex ${args[0] ?? ''} ${args[1] ?? ''} failed:\n${result.stderr.trim()}`);
	}
	return result.stdout;
}

const deploymentQuery =
	'({ siteUrl: process.env.CONVEX_SITE_URL, fingerprint: process.env.BUDGE_AGENT_KEY_SHA256 ?? null })';

function deploymentOf(target: string[]) {
	const answer: unknown = JSON.parse(convex(['run', '--inline-query', deploymentQuery, ...target]));
	const { siteUrl, fingerprint } = (answer ?? {}) as Record<string, unknown>;
	if (typeof siteUrl !== 'string' || !siteUrl.startsWith('http')) {
		throw new Error('the deployment did not report its site URL.');
	}
	return { siteUrl, fingerprint: typeof fingerprint === 'string' ? fingerprint : null };
}

function isLocal(siteUrl: string) {
	return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(siteUrl).hostname);
}

function namesCloud(target: string[]) {
	return target.length > 0 && target[1] !== 'local';
}

function linksCloudProject(checkout: string) {
	const { name } = deploymentEnvOf(checkout);
	return name !== '' && !name.startsWith('anonymous:');
}

async function resolveTarget(target: string[]) {
	if (!namesCloud(target)) return { target, ...deploymentOf(target) };
	const { checkout } = findCheckout();
	const overrides = deploymentOverrides(checkout).filter(
		(where) => !where.endsWith('in the environment')
	);
	if (overrides.length > 0) {
		throw nothingChanged(
			`${overrides.join(', ')} would make the Convex CLI ignore ${target.join(' ')} and use another deployment.`,
			`Remove ${overrides.length === 1 ? 'it' : 'them'}, then run this again.`
		);
	}
	if (target[0] === '--prod' && !linksCloudProject(checkout)) return productionThroughLogin();
	const found = deploymentOf(target);
	if (isLocal(found.siteUrl)) {
		throw nothingChanged(
			`${UNLINKED}, so the Convex CLI answered for ${target[1] ?? ''} from the local backend (${found.siteUrl}) instead of a cloud deployment.`,
			FIND_PRODUCTION,
			NAME_PRODUCTION
		);
	}
	return { target, ...found };
}

async function productionThroughLogin() {
	const token = convexLoginToken();
	const found: string[][] = [];
	for (const team of await convexTeams(token)) {
		const reference = await productionReference(token, team);
		if (reference !== undefined) found.push(['--deployment', reference]);
	}
	const [target] = found;
	if (target === undefined) {
		throw nothingChanged(
			`${UNLINKED}, so setup looked for production through your Convex login, and none of your Convex teams has a ${CONVEX_PROJECT} project with a production deployment.`,
			NAME_PRODUCTION.replace('Or name it yourself', 'Name it yourself')
		);
	}
	if (found.length > 1) {
		throw nothingChanged(
			`${UNLINKED}, and your Convex login reaches ${String(found.length)} ${CONVEX_PROJECT} production deployments.`,
			['Pick one:', ...found.map((each) => `  bun run agent setup ${each.join(' ')}`)].join('\n')
		);
	}
	console.log(`Found production through your Convex login: ${target[1] ?? ''}.`);
	return { target, ...deploymentOf(target) };
}

function convexLoginToken() {
	const notLoggedIn = nothingChanged(
		`${UNLINKED}, so --prod can't reach production from here, and setup can't find it without your Convex login.`,
		LOG_IN,
		NAME_PRODUCTION
	);
	let token: unknown;
	try {
		const config: unknown = JSON.parse(
			readFileSync(join(homedir(), '.convex', 'config.json'), 'utf8')
		);
		token = (config as Record<string, unknown> | null)?.accessToken;
	} catch {
		throw notLoggedIn;
	}
	if (typeof token !== 'string' || token === '') throw notLoggedIn;
	treatAsSecret([token]);
	return token;
}

async function convexApi(token: string, path: string): Promise<unknown> {
	let response: Response;
	try {
		response = await fetch(`https://api.convex.dev${path}`, {
			headers: { authorization: `Bearer ${token}` }
		});
	} catch (error) {
		throw nothingChanged(
			`Setup couldn't reach api.convex.dev to find production (${error instanceof Error ? error.message : String(error)}).`,
			'Check your connection, then run this again.'
		);
	}
	if (response.status === 404) return undefined;
	if (response.status === 401 || response.status === 403) {
		throw nothingChanged(
			`Convex refused your login (HTTP ${String(response.status)}) when setup looked for production.`,
			LOG_IN,
			NAME_PRODUCTION
		);
	}
	if (!response.ok) {
		throw nothingChanged(
			`Convex answered HTTP ${String(response.status)} when setup looked for production.`,
			'Run this again in a moment.',
			NAME_PRODUCTION
		);
	}
	try {
		return (await response.json()) as unknown;
	} catch {
		throw unexpectedAnswer('an answer');
	}
}

function unexpectedAnswer(what: string) {
	return nothingChanged(
		`Convex sent ${what} in a shape setup doesn't recognize, so it can't find production.`,
		NAME_PRODUCTION.replace('Or name it yourself', 'Name it yourself')
	);
}

async function convexTeams(token: string) {
	const teams = await convexApi(token, '/api/teams');
	if (!Array.isArray(teams)) throw unexpectedAnswer('your team list');
	return teams.map((team: unknown) => {
		const slug = (team as Record<string, unknown> | null)?.slug;
		if (typeof slug !== 'string') throw unexpectedAnswer('your team list');
		return slug;
	});
}

async function productionReference(token: string, team: string) {
	const project = await convexApi(
		token,
		`/v1/teams/${encodeURIComponent(team)}/projects/${CONVEX_PROJECT}`
	);
	if (project === undefined) return undefined;
	const { teamSlug, slug, prodDeploymentName } = (project ?? {}) as Record<string, unknown>;
	if (prodDeploymentName === null) return undefined;
	if (
		typeof teamSlug !== 'string' ||
		typeof slug !== 'string' ||
		typeof prodDeploymentName !== 'string'
	) {
		throw unexpectedAnswer(`the ${CONVEX_PROJECT} project in team ${team}`);
	}
	return `${teamSlug}:${slug}:prod`;
}

function fingerprintOf(key: string) {
	return createHash('sha256').update(key).digest('hex');
}

function newKey() {
	const key = `budge_agent_${randomBytes(32).toString('base64url')}`;
	return { key, fingerprint: fingerprintOf(key) };
}

function admitNewKey(siteUrl: string, target: string[]) {
	const { key, fingerprint } = newKey();
	convex(['env', 'set', FINGERPRINT_VARIABLE, ...target], fingerprint);
	const config: AgentConfig = { siteUrl, key, target };
	writeAgentConfig(config);
	return config;
}

function register(cli: 'claude' | 'codex') {
	const server = [
		process.execPath,
		'--no-env-file',
		join(import.meta.dirname, '..', 'agent.ts'),
		'serve'
	];
	const scope = cli === 'claude' ? ['--scope', 'user'] : [];
	const removed = spawnSync(cli, ['mcp', 'remove', ...scope, SERVER_NAME], { encoding: 'utf8' });
	if (removed.error !== undefined)
		return { registered: true, report: `${cli}: not installed, skipped` };
	const added = spawnSync(cli, ['mcp', 'add', ...scope, SERVER_NAME, '--', ...server], {
		encoding: 'utf8'
	});
	if (added.status === 0) {
		return { registered: true, report: `${cli}: registered the ${SERVER_NAME} tools` };
	}
	return { registered: false, report: `${cli}: registration failed: ${added.stderr.trim()}` };
}

export async function setup(args: string[]) {
	const { target, siteUrl } = await resolveTarget(targetOf(args));
	admitNewKey(siteUrl, target);
	console.log(`Agent access is on for ${describeTarget(target)} (${siteUrl}).`);
	console.log(`The Agent Key is in ${agentConfigPath()}, readable only by you.`);
	if (args.includes('--no-register')) return;
	for (const cli of ['claude', 'codex'] as const) {
		const { registered, report } = register(cli);
		console.log(report);
		if (!registered) process.exitCode = 1;
	}
}

function requireConfig() {
	const config = readAgentConfig();
	if (config === undefined) {
		throw new Error(`no Agent Key at ${agentConfigPath()}. Run \`bun run agent setup\` first.`);
	}
	return config;
}

function admitsLocalKey({ siteUrl, key, target }: AgentConfig) {
	const found = deploymentOf(target);
	if (found.siteUrl !== siteUrl) {
		throw new Error(
			`the Agent Key belongs to ${siteUrl}, but from here ${describeTarget(target)} is ${found.siteUrl}. Run this in the checkout that ran setup.`
		);
	}
	if (found.fingerprint === null) return 'off';
	return found.fingerprint === fingerprintOf(key) ? 'admitted' : 'another key';
}

export function rotate() {
	const config = requireConfig();
	const { siteUrl, target } = config;
	if (admitsLocalKey(config) !== 'admitted') {
		throw new Error(
			`${describeTarget(target)} (${siteUrl}) does not admit the Agent Key in ${agentConfigPath()}. Run ${agentCommand('setup', target)} to replace both.`
		);
	}
	admitNewKey(siteUrl, target);
	console.log(`Replaced the Agent Key for ${describeTarget(target)}. The old key no longer works.`);
}

export async function revoke(args: string[]) {
	const config = readAgentConfig();
	const asked = targetOf(args);
	if (config === undefined) {
		const { target } = await resolveTarget(asked);
		convex(['env', 'remove', FINGERPRINT_VARIABLE, ...target]);
		console.log(`Agent access is off for ${describeTarget(target)}.`);
		return;
	}
	const { target } = config;
	if (
		asked.length > 0 &&
		asked.join(' ') !== target.join(' ') &&
		(await resolveTarget(asked)).siteUrl !== config.siteUrl
	) {
		throw new Error(
			`the Agent Key in ${agentConfigPath()} belongs to ${describeTarget(target)}, not ${describeTarget(asked)}. Run ${agentCommand('revoke', [])} first, then ${agentCommand('revoke', asked)}.`
		);
	}
	const state = admitsLocalKey(config);
	if (state === 'another key') {
		throw new Error(
			`${describeTarget(target)} admits a different Agent Key than the one in ${agentConfigPath()}, so revoking would cut off another checkout's agent. To turn it off anyway, delete that file and run ${agentCommand('revoke', target)}.`
		);
	}
	if (state === 'admitted') convex(['env', 'remove', FINGERPRINT_VARIABLE, ...target]);
	removeAgentConfig();
	console.log(`Agent access is off for ${describeTarget(target)}; the local Agent Key is deleted.`);
}
