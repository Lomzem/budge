import { join } from 'node:path';

import { readEnvFile } from './env-file';
import { treatAsSecret } from './redaction';

export const CREDENTIALS = [
	'PUBLIC_CLERK_PUBLISHABLE_KEY',
	'CLERK_SECRET_KEY',
	'CLERK_JWT_ISSUER_DOMAIN',
	'E2E_CLERK_USER_ID',
	'E2E_CLERK_USER_EMAIL'
] as const;
export type CredentialName = (typeof CREDENTIALS)[number];
export type Credentials = Record<CredentialName, string>;

export function findCredentials(mainCheckout: string): Partial<Credentials> {
	const mainEnv = readEnvFile(join(mainCheckout, '.env.local'));
	const found: Partial<Credentials> = {};
	for (const name of CREDENTIALS) {
		const inherited = process.env[name];
		const value = inherited === undefined || inherited === '' ? mainEnv.get(name) : inherited;
		if (value) found[name] = value;
	}
	treatAsSecret(Object.values(found));
	return found;
}

function clerkFrontendApiOf(publishableKey: string) {
	return Buffer.from(publishableKey.slice('pk_test_'.length), 'base64')
		.toString('utf8')
		.replace(/\$$/, '');
}

export function developmentInstanceProblems(credentials: Credentials): string[] {
	const problems: string[] = [];
	if (!credentials.PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_test_')) {
		problems.push('PUBLIC_CLERK_PUBLISHABLE_KEY is not a Clerk development key.');
	}
	if (!credentials.CLERK_SECRET_KEY.startsWith('sk_test_')) {
		problems.push('CLERK_SECRET_KEY is not a Clerk development key.');
	}
	if (!URL.canParse(credentials.CLERK_JWT_ISSUER_DOMAIN)) {
		problems.push('CLERK_JWT_ISSUER_DOMAIN is not a URL.');
	} else if (
		new URL(credentials.CLERK_JWT_ISSUER_DOMAIN).host !==
		clerkFrontendApiOf(credentials.PUBLIC_CLERK_PUBLISHABLE_KEY)
	) {
		problems.push(
			'CLERK_JWT_ISSUER_DOMAIN does not belong to the Clerk instance of the publishable key.'
		);
	}
	if (!credentials.E2E_CLERK_USER_ID.startsWith('user_')) {
		problems.push('E2E_CLERK_USER_ID is not a Clerk user ID.');
	}
	return problems;
}

export function missingCredentials(found: Partial<Credentials>) {
	return CREDENTIALS.filter((name) => found[name] === undefined);
}

function isComplete(found: Partial<Credentials>): found is Credentials {
	return missingCredentials(found).length === 0;
}

export function loadCredentials(mainCheckout: string): Credentials {
	const found = findCredentials(mainCheckout);
	if (!isComplete(found)) {
		throw new Error(
			`missing ${missingCredentials(found).join(', ')}. Set them in the environment or the main checkout's .env.local ` +
				'(Clerk development instance and its CI test user; see docs/agents/authentication.md).'
		);
	}
	const problems = developmentInstanceProblems(found);
	if (problems.length > 0) throw new Error(problems.join(' '));
	return found;
}
