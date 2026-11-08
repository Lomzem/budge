import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PREVIEW_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535)
	throw new Error('E2E_PREVIEW_PORT must be an integer from 1 to 65535.');

export default defineConfig({
	testDir: 'e2e',
	outputDir: 'test-results/playwright',
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
