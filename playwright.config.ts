import { defineConfig } from '@playwright/test';

// Smoke tests run only in CI, against an anonymous local Convex backend and the Clerk
// development instance.
export default defineConfig({
	testDir: 'e2e',
	globalSetup: './e2e/global.setup.ts',
	forbidOnly: !!process.env.CI,
	// Every test edits the same seeded budget, so they run one at a time.
	workers: 1,
	reporter: process.env.CI ? 'github' : 'list',
	webServer: {
		command: 'bun run build && bun run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI
	}
});
