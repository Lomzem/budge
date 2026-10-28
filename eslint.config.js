import js from '@eslint/js';
import convex from '@convex-dev/eslint-plugin';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

import svelteConfig from './svelte.config.js';

// Browser globals the domain module must not touch: those Node lacks, plus the
// browser storage and navigation APIs that recent Node versions also define.
const browserOnlyGlobals = new Set([
	...Object.keys(globals.browser).filter(
		(name) => !(name in globals.node) && !(name in globals.es2025)
	),
	'localStorage',
	'sessionStorage',
	'navigator',
	'location'
]);

export default defineConfig(
	globalIgnores([
		'.svelte-kit/',
		'build/',
		'.vercel/',
		'convex/_generated/',
		'test-results/',
		'playwright-report/'
	]),
	js.configs.recommended,
	ts.configs.strictTypeChecked,
	ts.configs.stylisticTypeChecked,
	svelte.configs.recommended,
	convex.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte']
			}
		},
		rules: {
			// typescript-eslint recommends leaving undefined-name checks to TypeScript.
			'no-undef': 'off',
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-explicit-any': 'error'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		files: ['**/*.js'],
		extends: [ts.configs.disableTypeChecked]
	},
	{
		// The domain module is pure: no Convex, SvelteKit, Svelte, or browser APIs.
		files: ['src/lib/domain/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['convex', 'convex/*', '**/convex/**', 'convex-test', '@convex-dev/*'],
							message: 'The domain module must not import Convex.'
						},
						{
							group: ['$app/*', '$env/*', '$service-worker', '@sveltejs/*'],
							message: 'The domain module must not import SvelteKit.'
						},
						{
							group: ['svelte', 'svelte/*', '*.svelte', '*.svelte.js', '*.svelte.ts'],
							message: 'The domain module must not import Svelte.'
						}
					]
				}
			],
			'no-restricted-globals': [
				'error',
				...[...browserOnlyGlobals].map((name) => ({
					name,
					message: 'The domain module must not use browser APIs.'
				}))
			]
		}
	},
	prettier
);
