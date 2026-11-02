import { generatedUiIgnores } from './eslint/ui-ownership.js';
import { plugin as shadcn } from '@shadcn/lint';
import { defineConfig, globalIgnores } from 'eslint/config';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';

import svelteConfig from './svelte.config.ts';

export default defineConfig(
	globalIgnores(['.svelte-kit/', 'build/', '.vercel/', 'convex/', ...generatedUiIgnores]),

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
