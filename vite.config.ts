import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		projects: [
			{
				test: {
					name: 'domain',
					environment: 'node',

					env: { TZ: 'America/Los_Angeles' },
					include: ['src/lib/domain/**/*.test.ts']
				}
			},
			{
				test: {
					name: 'lib',
					environment: 'node',
					include: ['src/lib/*.test.ts']
				}
			},
			{
				test: {
					name: 'ssr',
					environment: 'node',
					include: ['src/ssr.test.ts'],

					testTimeout: 30_000,
					hookTimeout: 60_000
				}
			},
			{
				test: {
					name: 'eslint',
					environment: 'node',
					include: ['eslint/**/*.test.js']
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
