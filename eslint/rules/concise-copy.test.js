import { RuleTester } from 'eslint';
import svelteParser from 'svelte-eslint-parser';
import { describe, it } from 'vitest';

import rule from './concise-copy.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const filename = '/repo/src/lib/example.svelte';
const options = [{ maxWords: 12 }];
const cutoverIntro =
	"Budge tracks money from this date on. Bank transactions dated earlier aren't brought in, and each Account's starting balance is its balance on this date.";

const long = (words) => ({ messageId: 'long', data: { words, maxWords: 12 } });

new RuleTester({ languageOptions: { parser: svelteParser } }).run('concise-copy', rule, {
	valid: [
		{ name: 'short copy', filename, options, code: '<p>Budge tracks money from this date.</p>' },
		{
			name: 'an expression is one word however long its source',
			filename,
			options,
			code: "<p>Starts on {since ?? 'the cutover date that the person picked'}.</p>"
		},
		{
			name: 'a child block starts a new run',
			filename,
			options,
			code: '<p>One two three four five six seven {#if a}eight nine ten eleven twelve thirteen{/if}</p>'
		}
	],
	invalid: [
		{
			name: 'the cutover intro an operator cut',
			filename,
			options,
			code: `<p class="text-muted-foreground">${cutoverIntro}</p>`,
			errors: [long(25)]
		},
		{
			name: 'inline elements join the run around them',
			filename,
			options,
			code: '<p>Rename, reorder, hide, or <strong>delete</strong> Categories and their groups. <a href="/">Assign money</a> to them on the Budget.</p>',
			errors: [long(16)]
		}
	]
});
