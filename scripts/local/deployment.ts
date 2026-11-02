import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readEnvFile } from './env-file';
import { treatAsSecret } from './redaction';

export interface LocalDeployment {
	name: string;
	url: string;
	adminKey: string;
}

export type DeploymentCheck =
	{ local: true; deployment: LocalDeployment } | { local: false; reason: string };

interface LocalConfig {
	deploymentName: string;
	cloudPort: number;
	adminKey: string;
}

const THIS_MACHINE = ['127.0.0.1', 'localhost'];

const DEPLOYMENT_SELECTORS = [
	'CONVEX_DEPLOY_KEY',
	'CONVEX_SELF_HOSTED_URL',
	'CONVEX_SELF_HOSTED_ADMIN_KEY'
] as const;

const CONVEX_CLI_ENV_FILES = ['.env.local', '.env'] as const;

export function localConfigPath(checkout: string) {
	return join(checkout, '.convex', 'local', 'default', 'config.json');
}

export function readLocalConfig(checkout: string): LocalConfig | undefined {
	const path = localConfigPath(checkout);
	if (!existsSync(path)) return undefined;
	const config = JSON.parse(readFileSync(path, 'utf8')) as {
		deploymentName?: unknown;
		ports?: { cloud?: unknown };
		adminKey?: unknown;
		instanceSecret?: unknown;
	};
	treatAsSecret(
		[config.adminKey, config.instanceSecret].filter((value) => typeof value === 'string')
	);
	if (
		typeof config.deploymentName !== 'string' ||
		typeof config.ports?.cloud !== 'number' ||
		typeof config.adminKey !== 'string'
	) {
		return undefined;
	}
	return {
		deploymentName: config.deploymentName,
		cloudPort: config.ports.cloud,
		adminKey: config.adminKey
	};
}

export function deploymentEnvOf(checkout: string) {
	const written = readEnvFile(join(checkout, '.env.local'));
	return {
		name: written.get('CONVEX_DEPLOYMENT') ?? '',
		url: written.get('PUBLIC_CONVEX_URL') ?? ''
	};
}

export function deploymentOverrides(checkout: string): string[] {
	const overrides: string[] = [];
	for (const file of CONVEX_CLI_ENV_FILES) {
		const values = readEnvFile(join(checkout, file));
		for (const name of DEPLOYMENT_SELECTORS)
			if (values.get(name)) overrides.push(`${name} in ${file}`);
	}
	if (readEnvFile(join(checkout, '.env')).get('CONVEX_DEPLOYMENT')) {
		overrides.push('CONVEX_DEPLOYMENT in .env');
	}
	for (const name of DEPLOYMENT_SELECTORS) {
		if (process.env[name]) overrides.push(`${name} in the environment`);
	}
	return [...new Set(overrides)];
}

function overridesReason(checkout: string) {
	const overrides = deploymentOverrides(checkout);
	if (overrides.length === 0) return undefined;
	return `${overrides.join(', ')} would make the Convex CLI choose another deployment; remove ${overrides.length === 1 ? 'it' : 'them'}`;
}

function claimedDeploymentReason(name: string, url: string) {
	if (name === '') return 'its .env.local names no CONVEX_DEPLOYMENT';
	if (!name.startsWith('anonymous:anonymous-')) {
		return `its CONVEX_DEPLOYMENT is a ${name.split(':')[0] ?? ''} deployment, not anonymous`;
	}
	if (!URL.canParse(url) || !THIS_MACHINE.includes(new URL(url).hostname)) {
		return 'its PUBLIC_CONVEX_URL is not on this machine';
	}
	return undefined;
}

function configMismatchReason(config: LocalConfig | undefined, name: string, url: string) {
	if (config === undefined) return "the deployment's state is not under its .convex/local";
	if (`anonymous:${config.deploymentName}` !== name) {
		return 'its .convex/local config is for a different deployment than CONVEX_DEPLOYMENT';
	}
	if (Number(new URL(url).port) !== config.cloudPort) {
		return 'its PUBLIC_CONVEX_URL is not the port its .convex/local config serves';
	}
	return undefined;
}

export function checkLocalAnonymousDeployment(checkout: string): DeploymentCheck {
	const { name, url } = deploymentEnvOf(checkout);
	const config = readLocalConfig(checkout);
	const reason =
		overridesReason(checkout) ??
		claimedDeploymentReason(name, url) ??
		configMismatchReason(config, name, url);
	if (reason !== undefined || config === undefined) {
		return { local: false, reason: reason ?? 'no local config' };
	}
	return {
		local: true,
		deployment: {
			name,
			url: `http://127.0.0.1:${String(config.cloudPort)}`,
			adminKey: config.adminKey
		}
	};
}

export function requireLocalAnonymousDeployment(checkout: string, action: string) {
	const check = checkLocalAnonymousDeployment(checkout);
	if (!check.local) {
		throw new Error(
			`refusing to ${action}: this checkout's backend is not a local anonymous deployment (${check.reason}). Run \`bun run app up\` first.`
		);
	}
	return check.deployment;
}

export function requireNoDeploymentOverrides(checkout: string, action: string) {
	const reason = overridesReason(checkout);
	if (reason !== undefined) throw new Error(`refusing to ${action}: ${reason}.`);
}
