import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';

import { convexCli } from '../local/backend';
import { findCheckout } from '../local/checkout';
import { inheritedEnvWithoutDeploymentSettings } from '../local/env-file';
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

export function setup(args: string[]) {
	const target = targetOf(args);
	const { siteUrl } = deploymentOf(target);
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

export function revoke(args: string[]) {
	const config = readAgentConfig();
	const asked = targetOf(args);
	if (config === undefined) {
		convex(['env', 'remove', FINGERPRINT_VARIABLE, ...asked]);
		console.log(`Agent access is off for ${describeTarget(asked)}.`);
		return;
	}
	const { target } = config;
	if (asked.length > 0 && asked.join(' ') !== target.join(' ')) {
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
