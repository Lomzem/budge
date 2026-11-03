import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PREVIEW_PORT ?? 4173);

export default defineConfig({
	testDir: 'e2e',
	globalSetup: './e2e/global.setup.ts',
	forbidOnly: !!process.env.CI,

	workers: 1,
	reporter: process.env.CI ? 'github' : 'list',
	webServer: {
		command: `bun run build && bun scripts/local/preview.ts ${String(port)}`,
		port,
		reuseExistingServer: !process.env.CI && process.env.E2E_OWN_PREVIEW !== '1'
	}
});
