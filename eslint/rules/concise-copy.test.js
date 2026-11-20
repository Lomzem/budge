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
			code: "<p>Starts on {since.toLocaleDateString('en-US', { dateStyle: 'long' })}.</p>"
		},
		{
			name: 'twelve words is the limit',
			filename,
			options,
			code: '<p>One two three four five six seven eight nine ten eleven twelve.</p>'
		},
		{
			name: 'a short attribute',
			filename,
			options,
			code: '<input placeholder="Search Payees, memos and Bank Text" />'
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
		},
		{
			name: 'thirteen words is over the limit',
			filename,
			options,
			code: '<p>One two three four five six seven eight nine ten eleven twelve thirteen.</p>',
			errors: [long(13)]
		},
		{
			name: 'a conditional branch is counted as the words it shows',
			filename,
			options,
			code: "<p>{busy ? 'One two three four five six seven eight nine ten eleven twelve thirteen.' : 'Done.'}</p>",
			errors: [long(13)]
		},
		{
			name: 'the longest branch of every conditional counts, however many conditionals join',
			filename,
			options,
			code: "<p>{a ? '' : 'one two '}{b ? '' : 'one two '}{c ? '' : 'one two '}{d ? '' : 'one two '}{e ? '' : 'one two '}{f ? '' : 'one two '}{g ? '' : 'one two'}</p>",
			errors: [long(14)]
		},
		{
			name: 'the report starts on the first word, where a disable-next-line comment points',
			filename,
			options,
			code: '<p>\n\tOne two three four five six seven eight nine ten eleven twelve thirteen.\n</p>',
			errors: [{ ...long(13), line: 2, column: 2 }]
		},
		{
			name: 'user-facing attributes are copy too',
			filename,
			options,
			code: '<button aria-label="One two three four five six seven eight nine ten eleven twelve {count}"></button><img alt="a" title="One two three four five six seven eight nine ten eleven twelve thirteen" />',
			errors: [long(13), long(13)]
		}
	]
});
