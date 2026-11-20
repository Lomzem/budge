import { RuleTester } from 'eslint';
import svelteParser from 'svelte-eslint-parser';
import { describe, it } from 'vitest';

import rule from './no-heading-lede.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const filename = '/repo/src/lib/example.svelte';
const lede = { messageId: 'lede' };

new RuleTester({ languageOptions: { parser: svelteParser } }).run('no-heading-lede', rule, {
	valid: [
		{ filename, code: '<h2>Export</h2><div><button>Download CSV</button></div>' },
		{ filename, code: '<h2>Export</h2><ul><li>CSV</li></ul>' },
		{
			filename,
			code: '<div>Export</div><p class="text-muted-foreground">Download CSV or JSON.</p>'
		},
		{
			filename,
			code: '<h2>Export</h2><div></div><p class="text-muted-foreground">Download CSV or JSON.</p>'
		},
		{
			filename,
			code: '<div><h2>Export</h2></div><p class="text-muted-foreground">Download CSV or JSON.</p>'
		},
		{
			filename,
			code: '<h1>Transactions</h1><p class="text-muted-foreground">Net balance <span>{total}</span></p>'
		},
		{
			filename,
			code: '<h1>No such Account</h1><p class="text-muted-foreground"><a href="/">All Transactions</a></p>'
		},
		{
			filename,
			code: '<h2>Warning</h2><p class="text-destructive">Its Transactions move, permanently.</p>'
		},
		{ filename, code: '<h4>Remove</h4><p class="text-muted-foreground">Imported ones stay.</p>' },
		{
			filename,
			code: "<AlertDialog.Title>Delete Groceries?</AlertDialog.Title><AlertDialog.Description>This can't be undone.</AlertDialog.Description>"
		}
	],
	invalid: [
		{
			filename,
			code: '<header><div><h1>Bank</h1><p class="text-muted-foreground">New transactions arrive Unapproved on each Account. Budge checks banks daily.</p></div></header>',
			errors: [lede]
		},
		{
			filename,
			code: '<h2>Your data</h2>\n<p class="text-sm text-muted-foreground">Download CSV or JSON.</p>',
			errors: [{ ...lede, line: 2, column: 1 }]
		},
		{
			filename,
			code: '<h3>Start date</h3>\n<!-- help -->\n<p class="text-muted-foreground">Budge tracks money from <time>{date}</time>.</p>',
			errors: [{ ...lede, line: 3, column: 1 }]
		},
		{
			filename,
			code: '<h2>Bills</h2><p class="text-muted-foreground">{#if bills}{:else}Nothing needs you right now.{/if}</p>',
			errors: [lede]
		},
		{
			filename,
			code: "<h2>Export</h2><p class=\"text-muted-foreground\">{busy ? 'Saving' : 'Download CSV or JSON.'}</p>",
			errors: [lede]
		},
		{
			filename,
			code: '<h2>Balance</h2><p class="text-muted-foreground">Your balance expires on day 1.</p>',
			errors: [lede]
		},
		{
			filename,
			code: '<h2>Bills</h2><p class="text-muted-foreground">{\'Budge pays bills for you.\'}</p>',
			errors: [lede]
		},
		{
			filename,
			code: '<h2>Bills</h2><p class:text-muted-foreground={quiet}>Budge pays bills for you.</p>',
			errors: [lede]
		}
	]
});
