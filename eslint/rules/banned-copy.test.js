import { RuleTester } from 'eslint';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';
import { describe, it } from 'vitest';

import rule from './banned-copy.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const why = 'is filler.';
const instead = 'When nothing needs doing, show nothing.';
const options = [
	{
		phrases: [
			['\\bright now\\b', 'i'],
			['\\bNothing needs you\\b', 'i'],
			['\\b(each|every) month\\b', 'i'],
			['\\bdue on the\\b', 'i'],
			['\\bmoved from\\b', 'i'],
			['\\bBudge (checks|tracks|imports|syncs|keeps|watches|looks|uses|will)\\b', ''],
			['\\bif (you|the bank)\\b', 'i'],
			[' · ', ''],
			['\\b(Tip|Note):', '']
		].map(([pattern, flags]) => ({ pattern, flags, why, instead }))
	}
];
const banned = (match) => ({ messageId: 'banned', data: { match, why, instead } });

const svelte = (code, ...matches) => ({
	filename: '/repo/src/lib/example.svelte',
	options,
	code,
	...(matches.length && { errors: matches.map(banned) })
});

new RuleTester({
	languageOptions: { parser: svelteParser, parserOptions: { parser: ts.parser } }
}).run('banned-copy in Svelte', rule, {
	valid: [
		svelte('<svelte:head><title>Bank · Budge</title></svelte:head>'),
		svelte("<p>Budge couldn't save that. Try again.</p>"),
		svelte('<p>$59.98 monthly, due 1st</p>'),
		svelte('<p>Refill to $20.00 monthly</p>'),
		svelte('<p>Right</p><p>now</p>'),
		svelte('<div class={"right now"}>Ready</div>')
	],
	invalid: [
		svelte('<p>Nothing needs you right now.</p>', 'right now', 'Nothing needs you'),
		svelte('<button aria-label={"Do it right now"}>x</button>', 'right now'),
		svelte('<p>Set aside $59.98 each month, due on the 1st</p>', 'each month', 'due on the'),
		svelte('<p>Starts on {date}, moved from {old}.</p>', 'moved from'),
		svelte(
			'<p>New transactions arrive Unapproved on each Account. Budge checks banks daily.</p>',
			'Budge checks'
		),
		svelte(
			'<p>Budge tracks money and imports bank transactions from this date</p>',
			'Budge tracks'
		),
		svelte('<p>Reconnect if the bank asks you to sign in again.</p>', 'if the bank'),
		svelte('<p>Set aside {amount} <strong>EACH</strong>\nmonth</p>', 'EACH month'),
		svelte('<p>Ready right now, RIGHT NOW.</p>', 'right now', 'RIGHT NOW'),
		svelte(
			'<img alt="Tip: add a photo" title="Tip: add a photo" /><input aria-label="Tip: add a name" aria-description="Tip: use your name" placeholder="Tip: name" />',
			'Tip:',
			'Tip:',
			'Tip:',
			'Tip:',
			'Tip:'
		),
		svelte('<script lang="ts">const text: string = "Note: export your data";</script>', 'Note:')
	]
});

const typescript = (code, ...matches) => ({
	filename: '/repo/src/lib/example.ts',
	options,
	code,
	...(matches.length && { errors: matches.map(banned) })
});

new RuleTester({ languageOptions: { parser: ts.parser } }).run('banned-copy in TypeScript', rule, {
	valid: [
		typescript("import 'right now'; export * from 'moved from'; import('due on the');"),
		typescript('const names = { "each month": 1, [`Tip:`]: 2 };'),
		typescript('const classes = cn("right now", clsx(`${what} · ${day}`));')
	],
	invalid: [
		typescript('const text: string = `Set aside ${amount} each month`;', 'each month'),
		typescript('const text = `${what} · due ${day}`;', ' · '),
		typescript('const text = "Reconnect if you lose access.";', 'if you')
	]
});
