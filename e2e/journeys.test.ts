import { clerk } from '@clerk/testing/playwright';

import { journeys } from './journeys';
import { test } from './test';

for (const journey of journeys) {
	test.describe(journey.name, () => {
		test.use({ fixture: journey.fixture });

		test(journey.title, async ({ page }) => {
			const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;
			if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');
			await page.goto('/sign-in');
			await clerk.signIn({ page, emailAddress: ownerEmail });
			await journey.run(page, { step: (name, body) => test.step(name, body) });
		});
	});
}
