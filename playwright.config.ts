import { defineConfig } from '@playwright/test';

// Smoke tests run only in CI, against an anonymous local Convex backend.
export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? 'github' : 'list',
	webServer: {
		command: 'bun run build && bun run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI
	}
});
