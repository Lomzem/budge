import { chromium } from '@playwright/test';

import { findCheckout } from '../local/checkout';
import { setUpClerkTesting, signInAsTestUser } from '../local/clerk';
import { loadCredentials } from '../local/credentials';
import { liveApp } from './owned';
import { keepPrivate, storageStatePath } from './state';
import type { Verb } from './verb';

export const login: Verb = {
	usage: 'bun run app login',
	summary: 'Sign in as the Clerk test user and save a Playwright storage state.',
	details: [
		'Needs `up`. Prints the storage-state path (gitignored, under .local-app/).',
		'Use it with Playwright: browser.newContext({ storageState: <path> }).'
	].join('\n'),
	run: async () => {
		const { checkout, mainCheckout } = findCheckout();
		const running = liveApp(checkout);
		if (running === undefined) {
			throw new Error('the app is not up. Run `bun run app up` first.');
		}
		const credentials = loadCredentials(mainCheckout);
		process.env.CLERK_SECRET_KEY = credentials.CLERK_SECRET_KEY;
		await setUpClerkTesting(credentials.PUBLIC_CLERK_PUBLISHABLE_KEY);

		const browser = await chromium.launch();
		try {
			const context = await browser.newContext({ baseURL: running.appUrl });
			const page = await context.newPage();
			await signInAsTestUser(page, credentials.E2E_CLERK_USER_EMAIL);
			await page.goto('/');
			const path = storageStatePath(checkout);
			await context.storageState({ path });
			keepPrivate(path);
			console.log(path);
		} finally {
			await browser.close();
		}
	}
};
