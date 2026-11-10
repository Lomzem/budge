import { describe, expect, test } from 'vitest';

import type { Id } from '$convex/_generated/dataModel';

import { SPLIT_LINE_LIMIT } from './domain/splits';
import {
	addLine,
	fillRemainder,
	choose,
	chooseLink,
	type AccountChoice,
	type Catalog,
	type Draft,
	followSaved,
	linkQuery,
	type Lookup,
	NEW_SIDE,
	openDraft,
	optionOf,
	recallQuery,
	removeLine,
	type Saved,
	view,
	type World
} from './transactionEditor';

const accountNamed = (name: string, kind: AccountChoice['kind'] = 'cash'): AccountChoice => ({
	_id: name as Id<'accounts'>,
	name,
	kind
});
const checking = accountNamed('checking');
const savings = accountNamed('savings');
const visa = accountNamed('visa', 'creditCard');
const accounts = [checking, savings, visa];

const groceries = 'groceries' as Id<'categories'>;
const rent = 'rent' as Id<'categories'>;
const retired = 'retired' as Id<'categories'>;
const catalog: Catalog = {
	readyToAssignId: 'ready' as Id<'categories'>,
	groups: [{ categories: [{ _id: groceries }, { _id: rent }] }]
};

const loaded = <A>(data: A): Lookup<A> => ({ kind: 'loaded', data, stale: false });
const loading = { kind: 'loading' } as const;
const failed = { kind: 'failed', stale: false } as const;

interface Candidate {
	readonly _id: Id<'transactions'>;
}
const noCandidates: Lookup<readonly Candidate[]> = loaded([]);

function worldWith(changes: Partial<World> = {}): World {
	return {
		saved: undefined,
		accounts,
		categories: loaded(catalog),
		payeeMemory: loading,
		...changes
	};
}

function newDraft(changes: Partial<Draft> = {}): Draft {
	const opened = openDraft({
		saved: undefined,
		defaultAccountId: checking._id,
		accounts,
		today: '2026-11-07'
	});
	return { ...opened, ...changes };
}

function savedRow(changes: Partial<Saved> = {}): Saved {
	return {
		accountId: checking._id,
		date: '2026-10-30',
		amount: -1250,
		payeeName: 'Corner Market',
		memo: null,
		categoryId: null,
		categoryName: null,
		splits: null,
		transfer: null,
		bankRows: [],
		...changes
	};
}

function payloadOf(draft: Draft, world: World, candidates = noCandidates) {
	return view(draft, world, candidates).payload;
}

describe('recalling the Payee’s last Category', () => {
	const typed = newDraft({ payee: '  Corner Market ', amount: '12.50' });

	test('asks about the trimmed Payee only while nothing was picked', () => {
		expect(recallQuery(typed)).toEqual({ name: 'Corner Market' });
		expect(recallQuery(newDraft({ payee: '   ' }))).toBeUndefined();
		expect(recallQuery(choose(typed, optionOf({ kind: 'uncategorized' }), worldWith()))).toBe(
			undefined
		);
		const categorized = openDraft({
			saved: savedRow({ categoryId: rent }),
			defaultAccountId: undefined,
			accounts,
			today: '2026-11-07'
		});
		expect(recallQuery(categorized)).toBeUndefined();
	});

	test.each([
		{ state: 'the lookup is loading', changes: { payeeMemory: loading } },
		{
			state: 'the lookup answers for an earlier Payee',
			changes: { payeeMemory: { kind: 'loaded', data: groceries, stale: true } }
		},
		{
			state: 'the remembered Category waits on the Categories',
			changes: { payeeMemory: loaded(groceries), categories: loading }
		}
	] satisfies { state: string; changes: Partial<World> }[])(
		'gives nothing to save while $state',
		({ changes }) => {
			const shown = view(typed, worldWith(changes), noCandidates);

			expect(shown.selection).toEqual({ kind: 'recalling' });
			expect(shown.payload).toEqual({ kind: 'waiting' });
		}
	);

	test.each([
		{
			failure: 'the lookup fails',
			changes: { payeeMemory: failed },
			message: "Budge couldn't look up this Payee's last Category. Pick one to save."
		},
		{
			failure: 'the Categories fail to load',
			changes: { payeeMemory: loaded(groceries), categories: failed },
			message: "Budge couldn't load the Categories. Pick Uncategorized or a Transfer to save."
		}
	] satisfies { failure: string; changes: Partial<World>; message: string }[])(
		'asks for a pick and gives nothing to save when $failure',
		({ changes, message }) => {
			const shown = view(typed, worldWith(changes), noCandidates);

			expect(shown.selection).toEqual({ kind: 'recallFailed', message });
			expect(shown.payload).toEqual({ kind: 'waiting' });
		}
	);

	test('saves with the remembered Category', () => {
		const payload = payloadOf(typed, worldWith({ payeeMemory: loaded(groceries) }));

		expect(payload).toEqual({
			kind: 'ready',
			fields: {
				accountId: checking._id,
				date: '2026-11-07',
				amount: -1250,
				memo: '',
				payee: '  Corner Market ',
				categoryId: groceries
			}
		});
	});

	test.each([
		{ memory: 'no Category', changes: { payeeMemory: loaded(null), categories: loading } },
		{ memory: 'a Category no longer listed', changes: { payeeMemory: loaded(retired) } }
	] satisfies { memory: string; changes: Partial<World> }[])(
		'saves Uncategorized when the Payee remembers $memory',
		({ changes }) => {
			const payload = payloadOf(typed, worldWith(changes));

			expect(payload).toMatchObject({ kind: 'ready' });
			expect(payload.kind === 'ready' && 'categoryId' in payload.fields).toBe(false);
		}
	);

	test('a picked Category wins over the remembered one', () => {
		const remembering = worldWith({ payeeMemory: loaded(groceries) });
		const picked = choose(typed, rent, remembering);

		expect(payloadOf(picked, remembering)).toMatchObject({
			kind: 'ready',
			fields: { categoryId: rent }
		});
	});
});

describe('splitting across Categories', () => {
	const remembering = worldWith({ payeeMemory: loaded(groceries) });
	const typed = newDraft({ payee: 'Corner Market', amount: '12.50' });
	const split = optionOf({ kind: 'split' });

	test('starts with the Category it had and no amounts, so the whole amount is left to split', () => {
		const draft = choose(typed, split, remembering);

		expect(draft.lines.map(({ categoryId, amount }) => ({ categoryId, amount }))).toEqual([
			{ categoryId: groceries, amount: '' },
			{ categoryId: '', amount: '' }
		]);
		expect(view(draft, remembering, noCandidates).remainder).toBe(1250);
	});

	test.each([
		{ from: 'a Transfer', draft: choose(typed, `transfer:${savings._id}`, remembering) },
		{ from: 'a Category still being looked up', draft: typed }
	])('starts its first line without a Category when switched from $from', ({ draft }) => {
		const lines = choose(draft, split, worldWith()).lines;

		expect(lines[0]?.categoryId).toBe('');
	});

	function filled(direction: Draft['direction'], amounts: [string, string]) {
		const draft = choose(typed, split, remembering);
		return {
			...draft,
			direction,
			lines: draft.lines.map((line, index) => ({
				...line,
				categoryId: index === 0 ? groceries : rent,
				amount: amounts[index] ?? ''
			}))
		};
	}

	function emptySecondLine() {
		const draft = filled('outflow', ['12.50', '']);
		return {
			...draft,
			lines: draft.lines.map((line, index) => (index === 1 ? { ...line, categoryId: '' } : line))
		};
	}

	function uncategorizedSecondLine() {
		const draft = filled('outflow', ['10.00', '2.50']);
		return {
			...draft,
			lines: draft.lines.map((line, index) => (index === 1 ? { ...line, categoryId: '' } : line))
		};
	}

	test.each([
		{ direction: 'outflow', amounts: ['15.00', '-2.50'], signed: [-1500, 250], total: -1250 },
		{ direction: 'inflow', amounts: ['10.00', '2.50'], signed: [1000, 250], total: 1250 }
	] satisfies {
		direction: Draft['direction'];
		amounts: [string, string];
		signed: number[];
		total: number;
	}[])('signs each $direction line by the Direction', ({ direction, amounts, signed, total }) => {
		const payload = payloadOf(filled(direction, amounts), remembering);

		expect(payload).toMatchObject({
			kind: 'ready',
			fields: {
				amount: total,
				payee: 'Corner Market',
				splits: [
					{ categoryId: groceries, amount: signed[0], memo: '' },
					{ categoryId: rent, amount: signed[1], memo: '' }
				]
			}
		});
	});

	test.each([
		{
			problem: 'one of two lines is left empty',
			draft: emptySecondLine(),
			message: 'Line 2 is empty. Pick its Category and amount.',
			blamed: { line: 2, part: 'lineCategory' }
		},
		{
			problem: 'a line that can be removed is left empty',
			draft: addLine(filled('outflow', ['10.00', '2.50'])),
			message: 'Line 3 is empty. Fill it in, or remove the line.',
			blamed: { line: 3, part: 'lineCategory' }
		},
		{
			problem: 'a line has no Category',
			draft: uncategorizedSecondLine(),
			message: 'Pick a Category for line 2.',
			blamed: { line: 2, part: 'lineCategory' }
		},
		{
			problem: 'a line amount is not money',
			draft: filled('outflow', ['12.50', 'lots']),
			message: "Enter line 2's amount, such as 12.50.",
			blamed: { line: 2, part: 'lineAmount' }
		},
		{
			problem: 'a line has no amount',
			draft: filled('outflow', ['12.50', '']),
			message: "Enter line 2's amount.",
			blamed: { line: 2, part: 'lineAmount' }
		},
		{
			problem: 'the lines fall short of the amount',
			draft: filled('outflow', ['10.00', '1.00']),
			message: '$1.50 is still left to split.',
			blamed: { line: 2, part: 'lineAmount' }
		},
		{
			problem: 'the lines go over the amount',
			draft: filled('outflow', ['10.00', '3.00']),
			message: 'The lines are $0.50 over the amount.',
			blamed: { line: 2, part: 'lineAmount' }
		}
	] satisfies {
		problem: string;
		draft: Draft;
		message: string;
		blamed: { line: number; part: 'lineCategory' | 'lineAmount' };
	}[])('refuses to save when $problem, pointing at the line', ({ draft, message, blamed }) => {
		const line = draft.lines[blamed.line - 1];

		expect(payloadOf(draft, remembering)).toEqual({
			kind: 'invalid',
			message,
			field: { kind: blamed.part, key: line?.key }
		});
	});

	test.each([
		{ blank: 'second', amounts: ['10.00', ''], signed: [-1000, -250] },
		{ blank: 'first', amounts: ['', '2.50'], signed: [-1000, -250] }
	] satisfies { blank: string; amounts: [string, string]; signed: [number, number] }[])(
		'saves the $blank line left blank as what is still left to split',
		({ amounts, signed }) => {
			expect(payloadOf(filled('outflow', amounts), remembering)).toMatchObject({
				kind: 'ready',
				fields: {
					splits: [
						{ categoryId: groceries, amount: signed[0] },
						{ categoryId: rent, amount: signed[1] }
					]
				}
			});
		}
	);

	test.each([
		{ amounts: ['12.50', ''], remainder: 0 },
		{ amounts: ['10.00', '1.00'], remainder: 150 },
		{ amounts: ['10.00', '5.00'], remainder: -250 },
		{ amounts: ['10.00', 'lots'], remainder: undefined }
	] satisfies { amounts: [string, string]; remainder: number | undefined }[])(
		'lines of $amounts leave $remainder cents',
		({ amounts, remainder }) => {
			expect(view(filled('outflow', amounts), remembering, noCandidates).remainder).toBe(remainder);
		}
	);

	test.each([
		{ amounts: ['10.00', ''], line: 1, filled: ['10.00', '2.50'] },
		{ amounts: ['', ''], line: 0, filled: ['12.50', ''] },
		{ amounts: ['10.00', '1.00'], line: 1, filled: ['10.00', '1.00'] },
		{ amounts: ['15.00', ''], line: 1, filled: ['15.00', ''] },
		{ amounts: ['lots', ''], line: 1, filled: ['lots', ''] }
	] satisfies { amounts: [string, string]; line: number; filled: [string, string] }[])(
		'filling line $line of $amounts gives $filled',
		({ amounts, line, filled: expected }) => {
			const draft = filled('outflow', amounts);
			const key = draft.lines[line]?.key ?? -1;

			expect(fillRemainder(draft, key).lines.map((each) => each.amount)).toEqual(expected);
		}
	);

	test('keeps between two lines and the line limit', () => {
		let draft = choose(typed, split, remembering);
		const [first] = draft.lines;
		expect(removeLine(draft, first?.key ?? -1).lines).toHaveLength(2);

		while (draft.lines.length < SPLIT_LINE_LIMIT) draft = addLine(draft);
		expect(addLine(draft).lines).toHaveLength(SPLIT_LINE_LIMIT);
		expect(new Set(draft.lines.map((line) => line.key)).size).toBe(SPLIT_LINE_LIMIT);

		const fewer = removeLine(draft, first?.key ?? -1);
		expect(fewer.lines.map((line) => line.key)).not.toContain(first?.key);
		expect(addLine(fewer).lines.map((line) => line.key)).not.toContain(first?.key);
	});

	test('a saved split opens with its lines turned by the Direction and saves them back', () => {
		const saved = savedRow({
			splits: [
				{ categoryId: groceries, categoryName: 'Groceries', amount: -1500, memo: 'food' },
				{ categoryId: rent, categoryName: 'Rent', amount: 250, memo: null }
			]
		});
		const draft = openDraft({ saved, defaultAccountId: undefined, accounts, today: '2026-11-07' });

		expect(draft.lines.map(({ amount, memo }) => ({ amount, memo }))).toEqual([
			{ amount: '15.00', memo: 'food' },
			{ amount: '−2.50', memo: '' }
		]);
		expect(payloadOf(draft, worldWith({ saved, categories: loading }))).toMatchObject({
			kind: 'ready',
			fields: {
				amount: -1250,
				splits: [
					{ categoryId: groceries, amount: -1500, memo: 'food' },
					{ categoryId: rent, amount: 250, memo: '' }
				]
			}
		});
	});
});

describe('transferring between Accounts', () => {
	test.each([
		{
			payment: 'from cash to a card',
			from: checking,
			to: visa,
			before: 'inflow',
			after: 'outflow'
		},
		{
			payment: 'into cash from a card',
			from: visa,
			to: checking,
			before: 'outflow',
			after: 'inflow'
		},
		{
			payment: 'between cash Accounts',
			from: checking,
			to: savings,
			before: 'inflow',
			after: 'inflow'
		}
	] satisfies {
		payment: string;
		from: AccountChoice;
		to: AccountChoice;
		before: Draft['direction'];
		after: Draft['direction'];
	}[])('a Transfer $payment leaves the Direction $after', ({ from, to, before, after }) => {
		const draft = newDraft({ accountId: from._id, direction: before, amount: '40.00' });
		const chosen = choose(draft, optionOf({ kind: 'transfer', accountId: to._id }), worldWith());

		expect(chosen.direction).toBe(after);
	});

	test('saves with no Payee or Category', () => {
		const draft = newDraft({ payee: 'Corner Market', amount: '40.00' });
		const chosen = choose(
			draft,
			optionOf({ kind: 'transfer', accountId: savings._id }),
			worldWith()
		);

		expect(payloadOf(chosen, worldWith())).toEqual({
			kind: 'ready',
			fields: {
				accountId: checking._id,
				date: '2026-11-07',
				amount: -4000,
				memo: '',
				payee: '',
				transferAccountId: savings._id
			}
		});
	});

	test('refuses to save a Transfer with its own Account', () => {
		const onCard = newDraft({ accountId: visa._id, amount: '40.00' });
		const chosen = choose(
			onCard,
			optionOf({ kind: 'transfer', accountId: checking._id }),
			worldWith()
		);
		const movedToTheSameAccount = { ...chosen, accountId: checking._id };

		expect(payloadOf(movedToTheSameAccount, worldWith())).toEqual({
			kind: 'invalid',
			message: 'Pick another Account to transfer with.',
			field: { kind: 'category' }
		});
	});

	describe('linking the other side of an import', () => {
		const imported = savedRow({ bankRows: [{}], payeeName: 'Transfer to savings' });
		const world = worldWith({ saved: imported });
		const opened = openDraft({ saved: imported, defaultAccountId: undefined, accounts, today: '' });
		const toSavings = choose(opened, optionOf({ kind: 'transfer', accountId: savings._id }), world);
		const pending = { _id: 'pending-side' as Id<'transactions'> };
		const other = { _id: 'other-side' as Id<'transactions'> };

		test('looks up sides only for an imported Transaction gaining a new Transfer', () => {
			expect(linkQuery(toSavings, world)).toEqual({
				transferAccountId: savings._id,
				date: '2026-10-30',
				amount: -1250
			});
			expect(linkQuery(toSavings, worldWith({ saved: { ...imported, bankRows: [] } }))).toBe(
				undefined
			);
			const alreadyLinked = worldWith({
				saved: { ...imported, transfer: { accountId: savings._id } }
			});
			expect(linkQuery(toSavings, alreadyLinked)).toBeUndefined();
		});

		test('gives nothing to save while the sides load', () => {
			expect(payloadOf(toSavings, world, loading)).toEqual({ kind: 'waiting' });
		});

		test('links the first side found unless a new side is chosen', () => {
			const found = loaded([pending, other]);

			expect(view(toSavings, world, found).link).toBe(pending._id);
			expect(payloadOf(toSavings, world, found)).toMatchObject({
				fields: { transferTransactionId: pending._id }
			});
			expect(payloadOf(chooseLink(toSavings, other._id), world, found)).toMatchObject({
				fields: { transferTransactionId: other._id }
			});
			const fresh = payloadOf(chooseLink(toSavings, NEW_SIDE), world, found);
			expect(fresh.kind === 'ready' && 'transferTransactionId' in fresh.fields).toBe(false);
		});
	});
});

describe('the Transaction around the Category', () => {
	test.each([
		{
			problem: 'no Account',
			changes: { accountId: '' },
			message: 'Pick an Account.',
			field: 'account'
		},
		{
			problem: 'an amount that is not money',
			changes: { amount: 'twelve' },
			message: 'Enter the amount, such as 12.50.',
			field: 'amount'
		}
	])('refuses to save with $problem', ({ changes, message, field }) => {
		expect(payloadOf(newDraft({ amount: '12.50', ...changes }), worldWith())).toEqual({
			kind: 'invalid',
			message,
			field: { kind: field }
		});
	});

	test('follows the saved date and amount until they are edited here', () => {
		const saved = savedRow();
		const opened = openDraft({ saved, defaultAccountId: undefined, accounts, today: '' });

		const untouched = followSaved(opened, { date: '2026-10-31', amount: 900 });
		expect(untouched).toMatchObject({ date: '2026-10-31', amount: '9.00', direction: 'inflow' });

		const edited = followSaved({ ...opened, amount: '13.00' }, { date: '2026-10-31', amount: 900 });
		expect(edited).toMatchObject({ date: '2026-10-31', amount: '13.00', direction: 'outflow' });

		const later = followSaved(edited, { date: '2026-11-01', amount: 900 });
		expect(later).toMatchObject({ date: '2026-11-01', amount: '13.00' });
	});
});
