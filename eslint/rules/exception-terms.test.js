import { RuleTester } from 'eslint';
import svelteParser from 'svelte-eslint-parser';
import { describe, it } from 'vitest';

import rule from './exception-terms.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const options = [{ rules: ['no-console'] }];
const filename = '/repo/src/lib/example.svelte';
const svelte = { filename, languageOptions: { parser: svelteParser } };

new RuleTester().run('exception-terms', rule, {
	valid: [
		{ options, code: '// eslint-disable-next-line no-alert\nlet a;' },
		{
			options,
			code: '// eslint-disable-next-line no-console -- the bank names it this way; expires 2999-01-01; approved by Owner\nlet a;'
		},
		{
			...svelte,
			options,
			code: '<!-- eslint-disable-next-line no-console -- quoted bank text; expires 2999-01-01; approved by Owner -->\n<p>x</p>'
		}
	],
	invalid: [
		{
			options,
			code: '// eslint-disable-next-line no-console -- it reads fine\nlet a;',
			errors: [{ messageId: 'terms' }]
		},
		{
			options,
			code: '/* eslint-disable no-alert, no-console -- reason; expires 2999-01-01; approved by Owner */',
			errors: [{ messageId: 'line', data: { rule: 'no-console' } }]
		},
		{
			options,
			code: '// eslint-disable-next-line\nlet a;',
			errors: [{ messageId: 'blanket' }]
		},
		{
			options,
			code: '/* eslint no-console: off */',
			errors: [{ messageId: 'line', data: { rule: 'no-console' } }]
		},
		{
			options,
			code: '// eslint-disable-next-line no-console -- quoted; expires 2999-99-99; approved by Owner\nlet a;',
			errors: [{ messageId: 'date', data: { rule: 'no-console', date: '2999-99-99' } }]
		},
		{
			...svelte,
			options,
			code: '<!-- eslint-disable -->\n<p>x</p>',
			errors: [{ messageId: 'blanket' }]
		},
		{
			options,
			code: '// eslint-disable-next-line no-console -- quoted; expires 2020-01-01; approved by Owner\nlet a;',
			errors: [{ messageId: 'expired', data: { rule: 'no-console', date: '2020-01-01' } }]
		},
		{
			...svelte,
			options,
			code: '<!-- eslint-disable-next-line no-console -->\n<p>x</p>',
			errors: [{ messageId: 'terms' }]
		}
	]
});
