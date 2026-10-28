// `bun run lint:ui`: @shadcn/lint design-system rules for Svelte components.
// Kept apart from eslint.config.js so the main lint and the UI lint run as separate checks.
import { plugin as shadcn } from '@shadcn/lint';
import { defineConfig, globalIgnores } from 'eslint/config';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';

import svelteConfig from './svelte.config.js';

export default defineConfig(
	// shadcn-svelte's generated components own their styles.
	globalIgnores(['.svelte-kit/', 'build/', '.vercel/', 'convex/', 'src/lib/components/ui/']),
	// The main lint reports unused disable directives.
	{ linterOptions: { reportUnusedDisableDirectives: 'off' } },
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: { parser: ts.parser, svelteConfig }
		},
		plugins: { shadcn },
		rules: {
			'shadcn/no-restyle': 'error',
			'shadcn/no-raw-colors': 'error',
			'shadcn/no-arbitrary-values': 'error',
			'shadcn/no-inline-styles': 'error',
			'shadcn/no-unknown-classes': 'error',
			'shadcn/require-static-classes': 'error'
		}
	}
);
