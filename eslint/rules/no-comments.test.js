import { RuleTester } from 'eslint';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';
import { describe, it } from 'vitest';

import noComments from './no-comments.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const reported = (name, code, count = 1) => ({
	name,
	code,
	errors: Array.from({ length: count }, () => ({ messageId: 'comment' }))
});

new RuleTester({ languageOptions: { parser: ts.parser } }).run(
	'no-comments in TypeScript',
	noComments,
	{
		valid: [
			{ name: 'next line', code: '// eslint-disable-next-line no-console\nconsole.log(1);' },
			{
				name: 'next line reason',
				code: '// eslint-disable-next-line no-console -- the reason\nconsole.log(1);'
			},
			{ name: 'same line', code: 'console.log(1); // eslint-disable-line no-console' },
			{
				name: 'disable and enable',
				code: '/* eslint-disable no-console -- a reason */\nconsole.log(1);\n/* eslint-enable no-console */'
			},
			{ name: 'disable file', code: '/* eslint-disable */' },
			{
				name: 'expected error reason',
				code: '// @ts-expect-error -- the reason\nconst a: string = 1;'
			},
			{ name: 'expected error', code: '// @ts-expect-error\nconst a: string = 1;' },
			{ name: 'Effect diagnostics', code: '// @effect-diagnostics floatingEffect:off' },
			{ name: 'Prettier', code: '// prettier-ignore\nconst a = [1,2];' },
			{ name: 'no comments', code: 'const a = 1;' },
			{ name: 'template string content', code: 'const text = `/* text */`;' }
		],
		invalid: [
			reported('template interpolation', 'const text = `${/* x */ a}`;'),
			reported('type alias', 'type Value = /* x */ string;'),
			reported('type parameter', 'type Value</* x */ T> = T;'),
			reported('type annotation', 'const a: /* x */ number = 1;'),
			reported('line', '// a line comment\nconst a = 1;'),
			reported('block', '/* a block comment */\nconst a = 1;'),
			reported('JSDoc', '/** A doc comment. */\nexport function f() {}'),
			reported('trailing', 'const a = 1; // a trailing comment'),
			reported('header', '// A file header.\n// Its second line.\nimport x from "x";', 2),
			reported('function body', 'function f() {\n\t// inside a body\n\treturn 1;\n}'),
			reported('arrow expression gap', 'const f = () => /* in an expression-bodied arrow */ 1;'),
			reported('enable prefix', '/* eslint-enabled because */'),
			reported('next line prefix', '// eslint-disable-next-line-extra rule'),
			reported('directive colon', '// prettier-ignore: explanation'),
			reported('eslint prefix', '/* eslint-disabled because of a reason */\nconst a = 1;'),
			reported('prettier prefix', '// prettier-ignored here\nconst a = 1;'),
			reported('c8', '/* c8 ignore next */'),
			reported('istanbul', '/* istanbul ignore next */'),
			reported('effect suffix', '// @effect-diagnostics-next-line floatingEffect:off'),
			reported('effect prefix', '// @effect-diagnosticsExtra floatingEffect:off'),
			reported('svelte prefix', '// svelte-ignore-extra a11y_autofocus'),
			reported('TypeScript prefix', '// @ts-expect-error-extra'),
			reported('ts-ignore', '// @ts-ignore\nconst a: string = 1;'),
			reported('embedded directive', '// see eslint-disable-next-line below\nconst a = 1;')
		]
	}
);

new RuleTester({
	languageOptions: { parser: svelteParser, parserOptions: { parser: ts.parser } }
}).run('no-comments in Svelte', noComments, {
	valid: [
		{
			filename: 'Component.svelte',
			name: 'markup directive',
			code: '<!-- svelte-ignore a11y_autofocus -->\n<input autofocus />'
		},
		{
			filename: 'Component.svelte',
			name: 'script directive',
			code: '<script lang="ts">\n\t// eslint-disable-next-line prefer-const\n\tlet a = 1;\n</script>\n<p>{a}</p>'
		},
		{
			filename: 'Component.svelte',
			name: 'style directive',
			code: '<style>\n\t/* prettier-ignore */\n\tp { color: red; }\n</style>'
		}
	],
	invalid: [
		{
			filename: 'Component.svelte',
			...reported('expression', '<script>const value = 1;</script>{/* x */ value}')
		},
		{
			filename: 'Component.svelte',
			...reported('markup', '<!-- A markup comment. -->\n<p>hi</p>')
		},
		{
			filename: 'Component.svelte',
			...reported(
				'script JSDoc',
				'<script lang="ts">\n\t/** A doc comment. */\n\tconst a = 1;\n</script>\n<p>{a}</p>'
			)
		},
		{
			filename: 'Component.svelte',
			...reported(
				'script line',
				'<script lang="ts">\n\t// A script comment.\n\tconst a = 1;\n</script>\n<p>{a}</p>'
			)
		},
		{
			filename: 'Component.svelte',
			...reported('markup prefix', '<!-- svelte-ignored a11y_autofocus -->')
		},
		{
			filename: 'Component.svelte',
			...reported('SCSS line', '<style lang="scss">\n// forbidden\np { color: red; }\n</style>')
		},
		{
			filename: 'Component.svelte',
			...reported(
				'PostCSS block',
				'<style lang="postcss">/* forbidden */ p { color: red; }</style>'
			)
		},
		{
			filename: 'Component.svelte',
			code: '<style>/* forbidden */</style>',
			errors: [{ messageId: 'comment', line: 1, column: 8, endLine: 1, endColumn: 23 }]
		},
		{
			filename: 'Component.svelte',
			...reported('style', '<style>\n\t/* A style comment. */\n\tp { color: red; }\n</style>')
		}
	]
});

new RuleTester().run('no-comments in JavaScript', noComments, {
	valid: [{ name: 'no comments', code: 'const f = () => 1;' }],
	invalid: [reported('arrow expression gap', 'const f = () => /* gap */ 1;')]
});

new RuleTester({ languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } }).run(
	'no-comments in JSX',
	noComments,
	{ valid: [], invalid: [reported('JSX comment', 'const el = <div>{/* x */}</div>;')] }
);
