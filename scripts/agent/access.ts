import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';

import { convexCli } from '../local/backend';
import { findCheckout } from '../local/checkout';
import { inheritedEnvWithoutDeploymentSettings } from '../local/env-file';
import {
	agentConfigPath,
	readAgentConfig,
	removeAgentConfig,
	writeAgentConfig,
	type AgentConfig
} from './config';

const FINGERPRINT_VARIABLE = 'BUDGE_AGENT_KEY_SHA256';
const SERVER_NAME = 'budge';

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

function siteUrlOf(target: string[]) {
	const answer: unknown = JSON.parse(
		convex(['run', '--inline-query', 'process.env.CONVEX_SITE_URL', ...target])
	);
	if (typeof answer !== 'string' || !answer.startsWith('http')) {
		throw new Error('the deployment did not report its site URL.');
	}
	return answer;
}

function newKey() {
	const key = `budge_agent_${randomBytes(32).toString('base64url')}`;
	return { key, fingerprint: createHash('sha256').update(key).digest('hex') };
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

export function setup(args: string[]) {
	const target = targetOf(args);
	const siteUrl = siteUrlOf(target);
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

function requireSameDeployment({ siteUrl, target }: AgentConfig) {
	const found = siteUrlOf(target);
	if (found !== siteUrl) {
		throw new Error(
			`the Agent Key belongs to ${siteUrl}, but from here ${describeTarget(target)} is ${found}. Run this in the checkout that ran setup.`
		);
	}
}

export function rotate() {
	const config = requireConfig();
	requireSameDeployment(config);
	const { siteUrl, target } = config;
	admitNewKey(siteUrl, target);
	console.log(`Replaced the Agent Key for ${describeTarget(target)}. The old key no longer works.`);
}

export function revoke(args: string[]) {
	const config = readAgentConfig();
	if (config !== undefined) requireSameDeployment(config);
	const target = config?.target ?? targetOf(args);
	convex(['env', 'remove', FINGERPRINT_VARIABLE, ...target]);
	removeAgentConfig();
	console.log(`Agent access is off for ${describeTarget(target)}; the local Agent Key is deleted.`);
}
