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
import ownedWrites from './eslint/rules/owned-writes.js';
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

const journeyRunsOutsidePlaywrightTest =
	'A journey also runs outside Playwright Test, under `bun run app verify`; report steps through its context instead.';

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
			local: {
				rules: {
					'no-comments': noComments,
					'no-effect-defects': noEffectDefects,
					'owned-writes': ownedWrites
				}
			}
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
		files: ['convex/**/*.ts'],
		ignores: [
			'convex/lib/transactions.ts',
			'convex/lib/monthlyTotals.ts',
			'convex/migrations.ts',
			'convex/seed.ts',
			'convex/**/*.test.ts',
			'convex/test.helper.ts'
		],
		rules: {
			'local/owned-writes': [
				'error',
				{ tables: ['transactions', 'transactionSplits', 'imports', 'monthlyTotals'] }
			],
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							regex: '(^|/)transactions$',
							importNames: ['refreshSearchText'],
							message:
								'Call an operation in convex/lib/transactions.ts; it keeps search text whole.'
						},
						{
							regex: '(^|/)monthlyTotals$',
							importNames: ['countTransaction', 'rebuildTotals'],
							message:
								'Call an operation in convex/lib/transactions.ts; it keeps the monthly totals whole.'
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
		files: [
			'src/**/*-dialog.svelte',
			'src/lib/components/accounts/starting-balance-step.svelte',
			'src/lib/components/shell/bank-connections.svelte',
			'src/lib/components/shell/held-accounts.svelte'
		],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '$lib/attempt',
							message:
								'Run dialog work through DialogSession.run, so a late result never lands in a newer opening.'
						}
					]
				}
			]
		}
	},
	{
		files: ['e2e/journeys/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '@playwright/test',
							importNames: ['test'],
							message: journeyRunsOutsidePlaywrightTest
						},
						{ name: '../test', message: journeyRunsOutsidePlaywrightTest }
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
