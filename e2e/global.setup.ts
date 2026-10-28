import { clerkSetup } from '@clerk/testing/playwright';

// Fetches a Clerk testing token, so sign-in skips bot protection. Never creates users.
export default async function globalSetup() {
	const publishableKey = process.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
	if (!publishableKey) throw new Error('PUBLIC_CLERK_PUBLISHABLE_KEY is not set.');
	await clerkSetup({ publishableKey });
}
