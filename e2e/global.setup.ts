import { setUpClerkTesting } from '../scripts/local/clerk';
import { loadCredentials } from '../scripts/local/credentials';

export default async function globalSetup() {
	const credentials = loadCredentials(process.cwd());
	await setUpClerkTesting(credentials.PUBLIC_CLERK_PUBLISHABLE_KEY);
}
