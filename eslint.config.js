import { generatedUiIgnores } from './eslint/ui-ownership.js';
import js from '@eslint/js';
import convex from '@convex-dev/eslint-plugin';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

import bannedCopy from './eslint/rules/banned-copy.js';
import conciseCopy from './eslint/rules/concise-copy.js';
import noComments from './eslint/rules/no-comments.js';
import noEffectDefects from './eslint/rules/no-effect-defects.js';
import noHeadingLede from './eslint/rules/no-heading-lede.js';
import ownedWrites from './eslint/rules/owned-writes.js';
import shellQueries from './eslint/rules/shell-queries.js';
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

const keepStateThroughNavigation = {
	name: '$app/navigation',
	importNames: ['pushState', 'replaceState'],
	message:
		'Back restores a shallow history entry to the URL the page loaded with; write view state with keepInUrl from $lib/keepInUrl.'
};

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
					'banned-copy': bannedCopy,
					'concise-copy': conciseCopy,
					'no-comments': noComments,
					'no-effect-defects': noEffectDefects,
					'no-heading-lede': noHeadingLede,
					'owned-writes': ownedWrites,
					'shell-queries': shellQueries
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
							regex: '(^|/)transactions(\\.[cm]?[jt]s)?$',
							importNames: ['refreshDerivedFields'],
							message:
								'Call an operation in convex/lib/transactions.ts; it keeps search text whole.'
						},
						{
							regex: '(^|/)monthlyTotals(\\.[cm]?[jt]s)?$',
							importNames: ['countTransaction', 'countTransactions', 'rebuildTotals'],
							message:
								'Call an operation in convex/lib/transactions.ts; it keeps the monthly totals whole.'
						}
					]
				}
			]
		}
	},
	{
		files: ['src/**/*.{svelte,ts}'],
		rules: {
			'local/shell-queries': ['error', { owner: 'src/lib/shellQueries.svelte.ts' }]
		}
	},
	{
		files: ['src/**/*.svelte'],
		rules: {
			'local/concise-copy': ['error', { maxWords: 12 }],
			'local/no-heading-lede': 'error'
		}
	},
	{
		files: ['src/**/*.{svelte,ts}'],
		ignores: ['src/**/*.test.ts'],
		rules: {
			'local/banned-copy': [
				'error',
				{
					phrases: [
						{
							pattern: '\\bright now\\b',
							flags: 'i',
							why: 'is filler.',
							instead: 'When nothing needs doing, show nothing.'
						},
						{
							pattern: '\\bNothing needs you\\b',
							flags: 'i',
							why: 'narrates an empty state.',
							instead: 'Show nothing, or name the next action.'
						},
						{
							pattern: '\\b(each|every) month\\b',
							flags: 'i',
							why: 'is wordy.',
							instead: 'Write "monthly".'
						},
						{
							pattern: '\\bdue on the\\b',
							flags: 'i',
							why: 'is wordy.',
							instead: 'Write "due 1st".'
						},
						{
							pattern: '\\bmoved from\\b',
							flags: 'i',
							why: 'narrates history the person did not ask for.',
							instead: 'Show the current value only.'
						},
						{
							pattern: '\\bBudge (checks|tracks|imports|syncs|keeps|watches|looks|uses|will)\\b',
							why: 'explains how Budge works inside.',
							instead: 'Say what the person sees or does next, or say nothing.'
						},
						{
							pattern: '\\bif (you|the bank)\\b',
							flags: 'i',
							why: 'is conditional advice.',
							instead: 'Show the action when it is needed instead of explaining when to use it.'
						},
						{
							pattern: ' · ',
							why: 'joins meta with middle dots.',
							instead: 'Use a comma or separate elements.'
						},
						{
							pattern: '\\b(Tip|Note):',
							why: 'labels an explanation.',
							instead: 'Cut the explanation.'
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
		files: ['src/**'],
		rules: {
			'no-restricted-imports': ['error', { paths: [keepStateThroughNavigation] }]
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
						keepStateThroughNavigation,
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
		files: ['e2e/journeys/**/*.ts'],
		ignores: ['e2e/journeys/journey.ts'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='reload']",
					message:
						'Use reloadOnceSaved(page) so pending writes finish and the signed-in Section is ready.'
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
