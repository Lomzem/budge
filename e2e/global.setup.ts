import { setUpClerkTesting } from '../scripts/local/clerk';

export default async function globalSetup() {
	await setUpClerkTesting(process.env.PUBLIC_CLERK_PUBLISHABLE_KEY);
}
