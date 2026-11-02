import type { Config } from '@sveltejs/kit';
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: true
	},
	kit: {
		adapter: adapter({ runtime: 'nodejs24.x' }),
		alias: { $convex: 'convex' },
		typescript: {
			config: (tsconfig) => {
				const include = tsconfig.include as string[];
				include.push('../svelte.config.ts', '../playwright.config.ts', '../e2e/**/*.ts');
			}
		}
	}
} satisfies Config;

export default config;
