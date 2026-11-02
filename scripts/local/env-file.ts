import { existsSync, readFileSync } from 'node:fs';

export function readEnvFile(path: string): Map<string, string> {
	const values = new Map<string, string>();
	if (!existsSync(path)) return values;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
		if (!match?.[1] || match[2] === undefined) continue;
		values.set(match[1], match[2].replace(/^(['"])(.*)\1$/, '$2'));
	}
	return values;
}

const DEPLOYMENT_SECRET_AND_TEST_USER_SETTINGS =
	/^(CONVEX_|PUBLIC_CONVEX_|CLERK_|PUBLIC_CLERK_|BUDGE_|E2E_|DEPLOY_|PLAID_|VERIFIED_)/;

export function inheritedEnvWithoutDeploymentSettings(): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};
	for (const [name, value] of Object.entries(process.env)) {
		if (!DEPLOYMENT_SECRET_AND_TEST_USER_SETTINGS.test(name)) env[name] = value;
	}
	return env;
}
