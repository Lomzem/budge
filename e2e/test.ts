import { test as base } from '@playwright/test';

import { findFixture } from '../scripts/app/fixtures';
import { loadFixture } from '../scripts/app/seed';
import { requireLocalAnonymousDeployment } from '../scripts/local/deployment';

export { expect, type Download, type Locator, type Page } from '@playwright/test';

export const test = base.extend<{ fixture: string; seeded: undefined }>({
	fixture: ['budget-with-accounts', { option: true }],
	seeded: [
		async ({ fixture: name }, use, testInfo) => {
			if (testInfo.config.workers !== 1)
				throw new Error('E2E tests share a backend; run with --workers=1.');
			const fixture = findFixture(name);
			if (fixture === undefined) throw new Error(`No fixture named ${name}.`);
			const dir = process.cwd();
			await loadFixture(dir, requireLocalAnonymousDeployment(dir, 'seed an E2E test'), fixture);
			await use(undefined);
		},
		{ auto: true, timeout: 120_000 }
	]
});
