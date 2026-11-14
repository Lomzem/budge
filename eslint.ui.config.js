import { generatedUiIgnores } from './eslint/ui-ownership.js';
import { plugin as shadcn } from '@shadcn/lint';
import { defineConfig, globalIgnores } from 'eslint/config';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';

import svelteConfig from './svelte.config.ts';

const nativeScroll = String.raw`/\boverflow-(x-|y-)?(auto|scroll)\b/`;

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
			'shadcn/require-static-classes': 'error',
			'no-restricted-syntax': [
				'error',
				{
					selector: "SvelteElement[kind='html'][name.name='select']",
					message:
						'Use SelectField from $lib/components/select-field.svelte (the shadcn-svelte Select), or CategoryPicker from $lib/components/category-picker.svelte for a Category, instead of a native <select>.'
				},
				...[
					...["SvelteAttribute[key.name='class']", "CallExpression[callee.name='cn']"].flatMap(
						(owner) =>
							['SvelteLiteral[value', 'Literal[value', 'TemplateElement[value.raw'].map(
								(node) => `${owner} ${node}=${nativeScroll}]`
							)
					),
					`SvelteDirective[kind='Class'][key.name.name=${nativeScroll}]`
				].map((selector) => ({
					selector,
					message:
						'Scroll inside ScrollArea from $lib/components/ui/scroll-area, the shadcn-svelte ScrollArea, instead of an overflow-auto or overflow-scroll class.'
				}))
			]
		}
	}
);
