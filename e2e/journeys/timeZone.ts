import type { Page } from '@playwright/test';

export const journeyTimeZone = 'America/Los_Angeles';

export function useJourneyTimeZone() {
	process.env.TZ = journeyTimeZone;
}

export async function requireJourneyTimeZone(page: Page) {
	const browserZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
	const processZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	if (browserZone !== journeyTimeZone || processZone !== journeyTimeZone) {
		throw new Error(
			`Journeys run in ${journeyTimeZone}, but the browser runs in ${browserZone} and this process in ${processZone}. Create the browser context with timezoneId: journeyTimeZone and call useJourneyTimeZone().`
		);
	}
}
