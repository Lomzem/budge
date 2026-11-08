import { generatedUiIgnores } from './eslint/ui-ownership.js';
import js from '@eslint/js';
import convex from '@convex-dev/eslint-plugin';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

import noComments from './eslint/rules/no-comments.js';
import noEffectDefects from './eslint/rules/no-effect-defects.js';
import svelteConfig from './svelte.config.ts';

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

		...generatedUiIgnores,
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
		files: ['convex/**', 'src/**'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: 'TryStatement',
					message: 'Return a result or use Effect (`Effect.try`, `Effect.tryPromise`) instead.'
				},
				{
					selector: 'ThrowStatement',
					message: 'Return a result or use Effect instead of throwing.'
				}
			]
		}
	},
	{
		files: ['convex/**'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: 'TryStatement',
					message: 'Return a result or use Effect (`Effect.try`, `Effect.tryPromise`) instead.'
				},
				{
					selector: 'ThrowStatement:not([argument.callee.name="publicError"])',
					message:
						'Throw only `publicError(...)` from a Convex function; return failures otherwise.'
				}
			]
		}
	},
	{
		plugins: {
			local: { rules: { 'no-comments': noComments, 'no-effect-defects': noEffectDefects } }
		},
		rules: {
			'local/no-comments': 'error',
			'max-depth': ['error', 3],
			complexity: ['error', 15],
			'no-nested-ternary': 'error',
			'max-nested-callbacks': ['error', 3]
		}
	},
	{
		files: ['convex/**', 'src/**'],
		rules: {
			'local/no-effect-defects': [
				'error',
				{
					allow: [
						{
							file: 'convex/lib/plaidClient.ts',
							className: 'PlaidClient',
							method: 'layerTest',
							reason:
								'An unexpected call means the test fake violates its declared interaction contract.'
						}
					]
				}
			]
		}
	},
	{
		files: ['**/*.test.ts'],
		rules: { 'max-nested-callbacks': 'off' }
	},
	{
		files: ['e2e/**/*.{test,spec}.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '@playwright/test',
							message:
								"Import `test` from './test', which reloads a seed fixture before every test."
						}
					]
				}
			]
		}
	},
	{
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
