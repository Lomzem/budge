import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	globalSetup: './e2e/global.setup.ts',
	forbidOnly: !!process.env.CI,

	workers: 1,
	reporter: process.env.CI ? 'github' : 'list',
	webServer: {
		command: 'bun run build && bun run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI && process.env.E2E_OWN_PREVIEW !== '1'
	}
});
