import { defineConfig } from 'eslint/config';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';

import exceptionTerms from './eslint/rules/exception-terms.js';

export default defineConfig(
	{ linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'off' } },
	{ files: ['src/**/*.ts'], languageOptions: { parser: ts.parser } },
	{
		files: ['src/**/*.svelte'],
		languageOptions: { parser: svelteParser, parserOptions: { parser: ts.parser } }
	},
	{
		files: ['src/**/*.{svelte,ts}'],
		plugins: { local: { rules: { 'exception-terms': exceptionTerms } } },
		rules: {
			'local/exception-terms': [
				'error',
				{
					rules: [
						'local/banned-copy',
						'local/concise-copy',
						'local/no-heading-lede',
						'local/shell-queries'
					]
				}
			]
		}
	}
);
