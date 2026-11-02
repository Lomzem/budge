import { clerk, clerkSetup } from '@clerk/testing/playwright';
import type { Page } from '@playwright/test';

export async function setUpClerkTesting(publishableKey: string | undefined) {
	if (!publishableKey) throw new Error('PUBLIC_CLERK_PUBLISHABLE_KEY is not set.');
	await clerkSetup({ publishableKey });
}

export async function signInAsTestUser(page: Page, emailAddress: string) {
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress });
}
