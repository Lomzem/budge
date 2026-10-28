import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		// Inline projects don't inherit the plugins above, so tests run without SvelteKit.
		projects: [
			{
				test: {
					name: 'domain',
					environment: 'node',
					// West of UTC, so a date shifted by the time zone shows up as the day before.
					env: { TZ: 'America/Los_Angeles' },
					include: ['src/lib/domain/**/*.test.ts']
				}
			},
			{
				test: {
					name: 'ssr',
					environment: 'node',
					include: ['src/ssr.test.ts'],
					// Each suite starts the SvelteKit dev server.
					testTimeout: 30_000,
					hookTimeout: 60_000
				}
			},
			{
				test: {
					name: 'convex',
					environment: 'edge-runtime',
					include: ['convex/**/*.test.ts'],
					server: { deps: { inline: ['convex-test'] } }
				}
			}
		]
	}
});
