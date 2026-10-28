import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: true
	},
	kit: {
		adapter: adapter({ runtime: 'nodejs24.x' }),
		alias: { $convex: 'convex' },
		typescript: {
			// Typecheck the Playwright config and suite with the app.
			config: (tsconfig) => {
				tsconfig.include.push('../playwright.config.ts', '../e2e/**/*.ts');
			}
		}
	}
};

export default config;
