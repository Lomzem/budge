import { createHash } from 'node:crypto';

import { assert, beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { startBudget, useOwnerEnv } from './test.helper';

useOwnerEnv();

const agentKey = 'agent-key-synthetic-not-real';

type Backend = Awaited<ReturnType<typeof startBudget>>['t'];

interface Row {
	id: string;
	payee: string | null;
	category: { id: string; name: string } | null;
	amount: number;
	approved: boolean;
	splits: { category: { id: string }; amount: number }[];
}

beforeEach(() => {
	vi.stubEnv('BUDGE_AGENT_KEY_SHA256', createHash('sha256').update(agentKey).digest('hex'));
});

function agentPost(t: Backend, path: string, body: unknown) {
	return t.fetch(path, {
		method: 'POST',
		headers: { authorization: `Bearer ${agentKey}`, 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

async function rows(t: Backend) {
	const response = await t.fetch('/agent/transactions', {
		method: 'GET',
		headers: { authorization: `Bearer ${agentKey}` }
	});
	const { transactions } = (await response.json()) as { transactions: Row[] };
	return new Map(transactions.map((row) => [row.payee ?? 'transfer', row]));
}

async function apply(t: Backend, proposal: unknown) {
	const response = await agentPost(t, '/agent/proposals', proposal);
	expect(response.status).toBe(200);
	return (await response.json()) as {
		changes: { transactionId: string; outcome: string }[];
		created: { groups: { id: string; name: string }[]; categories: { id: string; name: string }[] };
	};
}

async function spending() {
	const backend = await startBudget({
		accounts: { Checking: ['cash', 100_000], Savings: ['cash', 50_000] },
		groups: { Everyday: ['Groceries', 'Dining', 'Old'], Archive: ['Retired'] }
	});
	const { owner, accounts, categories } = backend;
	const spend = { accountId: accounts.Checking, memo: '' };
	await owner.mutation(api.transactions.create, {
		...spend,
		date: '2026-08-10',
		amount: -6_789,
		payee: 'Corner Grocer',
		categoryId: categories.Groceries,
		rememberCategory: true
	});
	await owner.mutation(api.transactions.create, {
		...spend,
		date: '2026-08-12',
		amount: -10_000,
		payee: 'Market Hall',
		splits: [
			{ categoryId: categories.Groceries, amount: -6_000, memo: '' },
			{ categoryId: categories.Dining, amount: -4_000, memo: '' }
		]
	});
	await owner.mutation(api.transactions.create, {
		...spend,
		date: '2026-08-14',
		amount: -20_000,
		payee: '',
		transferAccountId: accounts.Savings
	});
	await owner.mutation(api.imports.commit, {
		accountId: accounts.Checking,
		source: 'csv',
		rows: [{ date: '2026-08-16', amount: -450, bankText: 'SAMPLE COFFEE 0042' }]
	});
	return { ...backend, read: await rows(backend.t) };
}

function idOf(read: Map<string, Row>, payee: string) {
	const row = read.get(payee);
	assert(row !== undefined, `no row for ${payee}`);
	return row.id;
}

describe('applying a Categorization Proposal', () => {
	test('moves a Reconciled Transaction to its new Category', async () => {
		const { t, owner, accounts, categories, read } = await spending();
		const grocer = idOf(read, 'Corner Grocer');
		await owner.mutation(api.transactions.setCleared, {
			transactionId: grocer as Id<'transactions'>,
			cleared: true
		});
		await owner.mutation(api.reconciliation.reconcile, {
			accountId: accounts.Checking,
			balance: 93_211,
			date: '2026-08-31'
		});

		const result = await apply(t, {
			id: 'reconciled',
			changes: [
				{
					transactionId: grocer,
					fromCategoryId: categories.Groceries,
					toCategoryId: categories.Dining
				}
			]
		});

		expect(result.changes.map((change) => change.outcome)).toEqual(['applied']);
		expect((await rows(t)).get('Corner Grocer')?.category?.id).toBe(categories.Dining);
	});

	test('moves Transactions to the Categories the owner approved, and nothing else', async () => {
		const { t, owner, categories, read } = await spending();

		const result = await apply(t, {
			id: 'proposal-1',
			changes: [
				{
					transactionId: idOf(read, 'Corner Grocer'),
					fromCategoryId: categories.Groceries,
					toCategoryId: categories.Dining
				},
				{
					transactionId: idOf(read, 'SAMPLE COFFEE 0042'),
					fromCategoryId: null,
					toCategoryId: categories.Dining
				}
			]
		});

		expect(result.changes.map((change) => change.outcome)).toEqual(['applied', 'applied']);
		const after = await rows(t);
		const dining = { id: categories.Dining, name: 'Dining' };
		for (const payee of ['Corner Grocer', 'SAMPLE COFFEE 0042']) {
			expect(after.get(payee)).toEqual({ ...read.get(payee), category: dining });
		}
		expect(after.get('SAMPLE COFFEE 0042')?.approved).toBe(false);
		expect(await owner.query(api.payees.lastCategory, { name: 'Corner Grocer' })).toBe(
			categories.Groceries
		);
	});

	test('leaves alone each change it may not make, and still makes the rest', async () => {
		const { t, owner, accounts, groups, categories, readyToAssignId, read } = await spending();
		for (const payee of ['Bakery', 'Deli', 'Kiosk', 'Stall']) {
			await owner.mutation(api.transactions.create, {
				accountId: accounts.Checking,
				date: '2026-08-18',
				amount: -500,
				payee,
				categoryId: categories.Groceries,
				memo: ''
			});
		}
		await owner.mutation(api.categories.setHidden, { categoryId: categories.Old, hidden: true });
		await owner.mutation(api.categories.setGroupHidden, { groupId: groups.Archive, hidden: true });
		const gone = await owner.mutation(api.categories.create, {
			groupId: groups.Everyday,
			name: 'Gone'
		});
		await owner.mutation(api.categories.remove, {
			categoryId: gone,
			destinationId: categories.Groceries
		});
		const now = await rows(t);
		const fromGroceries = (payee: string) => ({
			transactionId: idOf(now, payee),
			fromCategoryId: categories.Groceries
		});
		const toDining = { toCategoryId: categories.Dining };

		const result = await apply(t, {
			id: 'proposal-refusals',
			changes: [
				{ transactionId: idOf(read, 'transfer'), fromCategoryId: null, ...toDining },
				{
					transactionId: idOf(read, 'Starting Balance'),
					fromCategoryId: readyToAssignId,
					...toDining
				},
				{ transactionId: idOf(read, 'Market Hall'), fromCategoryId: null, ...toDining },
				{ ...fromGroceries('Bakery'), toCategoryId: readyToAssignId },
				{ ...fromGroceries('Deli'), toCategoryId: categories.Old },
				{ ...fromGroceries('Kiosk'), toCategoryId: categories.Retired },
				{ ...fromGroceries('Stall'), toCategoryId: gone },
				{
					transactionId: idOf(read, 'Corner Grocer'),
					fromCategoryId: categories.Dining,
					toCategoryId: categories.Groceries
				},
				{ transactionId: idOf(read, 'SAMPLE COFFEE 0042'), fromCategoryId: null, ...toDining }
			]
		});

		expect(result.changes.map((change) => change.outcome)).toEqual([
			'transfer',
			'startingBalance',
			'split',
			'notAllowed',
			'notAllowed',
			'notAllowed',
			'notAllowed',
			'changed',
			'applied'
		]);
		const after = await rows(t);
		expect(
			Object.fromEntries([...after].map(([payee, row]) => [payee, row.category?.id ?? null]))
		).toEqual({
			transfer: null,
			'Starting Balance': readyToAssignId,
			'Market Hall': null,
			Bakery: categories.Groceries,
			Deli: categories.Groceries,
			Kiosk: categories.Groceries,
			Stall: categories.Groceries,
			'Corner Grocer': categories.Groceries,
			'SAMPLE COFFEE 0042': categories.Dining
		});
		expect(after.get('Market Hall')?.splits.map((line) => line.category.id)).toEqual([
			categories.Groceries,
			categories.Dining
		]);
	});

	test('moves a split line by its position, keeping the split as it was', async () => {
		const { t, categories, read } = await spending();
		const marketHall = idOf(read, 'Market Hall');

		const result = await apply(t, {
			id: 'proposal-lines',
			changes: [
				{
					transactionId: marketHall,
					line: 1,
					fromCategoryId: categories.Dining,
					toCategoryId: categories.Old
				},
				{
					transactionId: marketHall,
					line: 0,
					fromCategoryId: categories.Groceries,
					toCategoryId: categories.Dining
				},
				{
					transactionId: marketHall,
					line: 2,
					fromCategoryId: categories.Groceries,
					toCategoryId: categories.Dining
				},
				{
					transactionId: idOf(read, 'Corner Grocer'),
					line: 0,
					fromCategoryId: categories.Groceries,
					toCategoryId: categories.Dining
				}
			]
		});

		expect(result.changes.map((change) => change.outcome)).toEqual([
			'applied',
			'applied',
			'changed',
			'changed'
		]);
		const after = await rows(t);
		expect(after.get('Market Hall')).toMatchObject({
			amount: -100,
			approved: true,
			splits: [
				{ category: { id: categories.Dining }, amount: -60 },
				{ category: { id: categories.Old }, amount: -40 }
			]
		});
		expect(after.get('Corner Grocer')?.category?.id).toBe(categories.Groceries);
	});

	test('adds the new Groups and Categories it names, and moves Transactions into them', async () => {
		const { t, owner, groups, read } = await spending();

		const result = await apply(t, {
			id: 'proposal-new-categories',
			newGroups: ['Treats'],
			newCategories: [
				{ name: 'Coffee', newGroup: 'Treats' },
				{ name: 'Snacks', groupId: groups.Everyday }
			],
			changes: [
				{
					transactionId: idOf(read, 'SAMPLE COFFEE 0042'),
					fromCategoryId: null,
					toNewCategory: 'Coffee'
				},
				{
					transactionId: idOf(read, 'Corner Grocer'),
					fromCategoryId: read.get('Corner Grocer')?.category?.id ?? null,
					toNewCategory: 'snacks'
				}
			]
		});

		expect(result.changes.map((change) => change.outcome)).toEqual(['applied', 'applied']);
		const { groups: listed } = await owner.query(api.categories.list, {});
		expect(
			listed.map((group) => [group.name, group.categories.map((category) => category.name)])
		).toEqual([
			['Everyday', ['Groceries', 'Dining', 'Old', 'Snacks']],
			['Archive', ['Retired']],
			['Treats', ['Coffee']]
		]);
		const after = await rows(t);
		expect(after.get('SAMPLE COFFEE 0042')?.category?.name).toBe('Coffee');
		expect(after.get('Corner Grocer')?.category?.name).toBe('Snacks');
	});

	test.each([
		['a new Group named like a Category Group', { newGroups: ['everyday'] }],
		[
			'a new Category named like a Category',
			{ newCategories: [{ name: 'DINING', groupId: '$EVERYDAY' }] }
		],
		[
			'a new Category in a Group the owner hid',
			{ newCategories: [{ name: 'Fresh', groupId: '$ARCHIVE' }] }
		],
		[
			'a new Category in a Group that is not a Group',
			{ newCategories: [{ name: 'Fresh', groupId: '$DINING' }] }
		]
	])('refuses %s, changing nothing', async (_, extra) => {
		const { t, owner, groups, categories, read } = await spending();
		await owner.mutation(api.categories.setGroupHidden, { groupId: groups.Archive, hidden: true });
		const before = await owner.query(api.categories.list, {});
		const body = JSON.parse(
			JSON.stringify(extra)
				.replace('$EVERYDAY', groups.Everyday)
				.replace('$ARCHIVE', groups.Archive)
				.replace('$DINING', categories.Dining)
		) as object;

		const response = await agentPost(t, '/agent/proposals', {
			id: 'proposal-clash',
			...body,
			changes: [
				{
					transactionId: idOf(read, 'SAMPLE COFFEE 0042'),
					fromCategoryId: null,
					toCategoryId: categories.Dining
				}
			]
		});

		expect(response.status).toBe(400);
		expect(await response.text()).toMatch(/\S/);
		expect(await owner.query(api.categories.list, {})).toEqual(before);
		expect((await rows(t)).get('SAMPLE COFFEE 0042')?.category).toBeNull();
	});
});

describe('re-sending a Categorization Proposal', () => {
	test('answers with the first result and makes no change again', async () => {
		const { t, owner, categories, read } = await spending();
		const cornerGrocer = idOf(read, 'Corner Grocer') as Id<'transactions'>;
		const proposal = {
			id: 'proposal-again',
			newGroups: ['Treats'],
			changes: [
				{
					transactionId: cornerGrocer,
					fromCategoryId: categories.Groceries,
					toCategoryId: categories.Dining
				}
			]
		};
		const first = await apply(t, proposal);
		await owner.mutation(api.transactions.categorize, {
			transactionId: cornerGrocer,
			choice: { kind: 'category', categoryId: categories.Groceries }
		});

		const again = await apply(t, proposal);

		expect(again).toEqual(first);
		expect(again.changes.map((change) => change.outcome)).toEqual(['applied']);
		expect((await rows(t)).get('Corner Grocer')?.category?.id).toBe(categories.Groceries);
		const { groups } = await owner.query(api.categories.list, {});
		expect(groups.filter((group) => group.name === 'Treats')).toHaveLength(1);
	});
});

describe('undoing a Categorization Proposal', () => {
	async function appliedThenEdited() {
		const backend = await spending();
		const { t, owner, accounts, groups, categories, read } = backend;
		const cornerGrocer = idOf(read, 'Corner Grocer') as Id<'transactions'>;
		await apply(t, {
			id: 'proposal-to-undo',
			newGroups: ['Treats'],
			newCategories: [
				{ name: 'Coffee', newGroup: 'Treats' },
				{ name: 'Snacks', groupId: groups.Everyday }
			],
			changes: [
				{
					transactionId: idOf(read, 'SAMPLE COFFEE 0042'),
					fromCategoryId: null,
					toNewCategory: 'Coffee'
				},
				{
					transactionId: cornerGrocer,
					fromCategoryId: categories.Groceries,
					toNewCategory: 'Snacks'
				},
				{
					transactionId: idOf(read, 'Market Hall'),
					line: 1,
					fromCategoryId: categories.Dining,
					toCategoryId: categories.Old
				}
			]
		});
		await owner.mutation(api.transactions.categorize, {
			transactionId: cornerGrocer,
			choice: { kind: 'category', categoryId: categories.Dining }
		});
		const snacks = await snacksId(owner);
		await owner.mutation(api.transactions.create, {
			accountId: accounts.Checking,
			date: '2026-08-20',
			amount: -300,
			payee: 'Vending',
			categoryId: snacks,
			memo: ''
		});
		return { ...backend, cornerGrocer };
	}

	async function snacksId(owner: Awaited<ReturnType<typeof spending>>['owner']) {
		const { groups } = await owner.query(api.categories.list, {});
		const snacks = groups
			.flatMap((group) => group.categories)
			.find((category) => category.name === 'Snacks');
		assert(snacks !== undefined, 'Snacks was not created');
		return snacks._id;
	}

	test("restores only what still has the agent's Category, and keeps what is in use", async () => {
		const { t, owner, categories, cornerGrocer } = await appliedThenEdited();

		const response = await agentPost(t, '/agent/proposals/undo', { id: 'proposal-to-undo' });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: 'proposal-to-undo',
			restored: 2,
			keptTransactionIds: [cornerGrocer],
			removedCategories: ['Coffee'],
			removedGroups: ['Treats']
		});
		const after = await rows(t);
		expect(after.get('SAMPLE COFFEE 0042')).toMatchObject({ category: null, approved: false });
		expect(after.get('Corner Grocer')?.category?.id).toBe(categories.Dining);
		expect(after.get('Market Hall')?.splits.map((line) => line.category.id)).toEqual([
			categories.Groceries,
			categories.Dining
		]);
		const { groups } = await owner.query(api.categories.list, {});
		expect(
			groups.map((group) => [group.name, group.categories.map((category) => category.name)])
		).toEqual([
			['Everyday', ['Groceries', 'Dining', 'Old', 'Snacks']],
			['Archive', ['Retired']]
		]);
	});

	type Spending = Awaited<ReturnType<typeof spending>>;
	test.each<[string, (backend: Spending, snacks: Id<'categories'>) => Promise<unknown>]>([
		[
			'a split line',
			({ owner, accounts, categories }, snacks) =>
				owner.mutation(api.transactions.create, {
					accountId: accounts.Checking,
					date: '2026-08-20',
					amount: -1_000,
					payee: 'Corner Shop',
					memo: '',
					splits: [
						{ categoryId: snacks, amount: -400, memo: '' },
						{ categoryId: categories.Groceries, amount: -600, memo: '' }
					]
				})
		],
		[
			'an Assignment',
			({ owner }, snacks) =>
				owner.mutation(api.budget.setAssigned, {
					month: '2026-08',
					categoryId: snacks,
					amount: 2_000
				})
		],
		[
			'a Target',
			({ owner }, snacks) =>
				owner.mutation(api.categories.setTarget, {
					categoryId: snacks,
					target: { kind: 'monthly', amount: 2_000, mode: 'refill' }
				})
		],
		[
			"a Payee's Remembered Category",
			async ({ owner, accounts }, snacks) => {
				const vending = await owner.mutation(api.transactions.create, {
					accountId: accounts.Checking,
					date: '2026-08-20',
					amount: -300,
					payee: 'Vending',
					categoryId: snacks,
					rememberCategory: true,
					memo: ''
				});
				await owner.mutation(api.transactions.remove, { transactionId: vending });
			}
		]
	])('keeps a new Category the owner has since used in %s', async (_use, useIt) => {
		const backend = await spending();
		const { t, owner, groups, read } = backend;
		await apply(t, {
			id: 'proposal-in-use',
			newCategories: [{ name: 'Snacks', groupId: groups.Everyday }],
			changes: [
				{
					transactionId: idOf(read, 'SAMPLE COFFEE 0042'),
					fromCategoryId: null,
					toNewCategory: 'Snacks'
				}
			]
		});
		await useIt(backend, await snacksId(owner));

		const response = await agentPost(t, '/agent/proposals/undo', { id: 'proposal-in-use' });

		expect(await response.json()).toMatchObject({ restored: 1, removedCategories: [] });
		const { groups: after } = await owner.query(api.categories.list, {});
		expect(after.flatMap((group) => group.categories.map((category) => category.name))).toContain(
			'Snacks'
		);
	});

	test('keeps a new Category that undoing the latest cutover move would put back', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-11-17T18:00:00Z'));
		onTestFinished(() => {
			vi.useRealTimers();
		});
		const { t, owner, groups, read } = await spending();
		await apply(t, {
			id: 'proposal-before-cutover',
			newCategories: [{ name: 'Snacks', groupId: groups.Everyday }],
			changes: [
				{
					transactionId: idOf(read, 'SAMPLE COFFEE 0042'),
					fromCategoryId: null,
					toNewCategory: 'Snacks'
				}
			]
		});
		const later = { cutoverDate: '2026-09-01', today: '2026-11-17' };
		const preview = await owner.query(api.settings.previewLaterCutover, later);
		assert(preview.kind === 'ready', `expected a ready preview, got ${preview.kind}`);
		const moveId = await owner.mutation(api.settings.applyLaterCutover, {
			...later,
			fingerprint: preview.fingerprint,
			unlockReconciled: true
		});

		const response = await agentPost(t, '/agent/proposals/undo', {
			id: 'proposal-before-cutover'
		});

		expect(await response.json()).toMatchObject({ restored: 0, removedCategories: [] });
		await owner.mutation(api.settings.undoLaterCutover, { moveId });
		expect((await rows(t)).get('SAMPLE COFFEE 0042')?.category?.name).toBe('Snacks');
	});

	test('answers a second undo with the first result and changes nothing more', async () => {
		const { t, owner, categories } = await appliedThenEdited();
		const first = await agentPost(t, '/agent/proposals/undo', { id: 'proposal-to-undo' });
		await owner.mutation(api.transactions.categorize, {
			transactionId: idOf(await rows(t), 'SAMPLE COFFEE 0042') as Id<'transactions'>,
			choice: { kind: 'category', categoryId: categories.Old }
		});

		const second = await agentPost(t, '/agent/proposals/undo', { id: 'proposal-to-undo' });

		expect(second.status).toBe(200);
		expect(await second.json()).toEqual(await first.json());
		expect((await rows(t)).get('SAMPLE COFFEE 0042')?.category?.id).toBe(categories.Old);
	});

	test('refuses an id no proposal was applied with', async () => {
		const { t } = await spending();

		const response = await agentPost(t, '/agent/proposals/undo', { id: 'proposal-unknown' });

		expect(response.status).toBe(400);
		expect(await response.text()).toMatch(/\S/);
	});
});

describe('the recent Categorization Proposals read', () => {
	test('lists applied proposals newest first, with what each did', async () => {
		const { t, categories, read } = await spending();
		const coffee = idOf(read, 'SAMPLE COFFEE 0042');
		await apply(t, {
			id: 'proposal-older',
			changes: [{ transactionId: coffee, fromCategoryId: null, toCategoryId: categories.Dining }]
		});
		await agentPost(t, '/agent/proposals/undo', { id: 'proposal-older' });
		await apply(t, {
			id: 'proposal-newer',
			changes: [
				{ transactionId: coffee, fromCategoryId: null, toCategoryId: categories.Groceries },
				{
					transactionId: idOf(read, 'transfer'),
					fromCategoryId: null,
					toCategoryId: categories.Dining
				}
			]
		});

		const response = await t.fetch('/agent/proposals', {
			method: 'GET',
			headers: { authorization: `Bearer ${agentKey}` }
		});

		expect(response.status).toBe(200);
		const appliedAt = expect.stringMatching(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
		) as unknown;
		expect(await response.json()).toEqual({
			proposals: [
				{ id: 'proposal-newer', appliedAt, applied: 1, refused: 1, undone: false },
				{ id: 'proposal-older', appliedAt, applied: 1, refused: 0, undone: true }
			]
		});
	});
});

describe('the Categorization Proposal routes', () => {
	test.each([
		['apply', 'POST', '/agent/proposals'],
		['undo', 'POST', '/agent/proposals/undo'],
		['the recent list', 'GET', '/agent/proposals']
	])('refuse %s without the Agent Key', async (_, method, path) => {
		const { t } = await spending();

		const response = await t.fetch(path, {
			method,
			headers: { authorization: 'Bearer agent-key-other-not-real' },
			...(method === 'POST' ? { body: JSON.stringify({ id: 'proposal-x' }) } : {})
		});

		expect(response.status).toBe(401);
	});
});

describe('a malformed Categorization Proposal', () => {
	interface Ids {
		coffee: string;
		dining: string;
		checking: string;
	}
	type Body = Record<string, unknown>;
	const change = (ids: Ids, extra: Body = {}) => ({
		transactionId: ids.coffee,
		fromCategoryId: null,
		toCategoryId: ids.dining,
		...extra
	});
	const many = (ids: Ids, count: number) =>
		Array.from({ length: count }, (_, line) => change(ids, { line }));

	test.each<[string, (ids: Ids) => unknown, string]>([
		['a body that is not JSON', () => '{"id": ', 'JSON'],
		['a body that is a list', () => [], 'JSON object'],
		['a missing id', (ids) => ({ changes: [change(ids)] }), 'id must'],
		['an id with spaces', (ids) => ({ id: 'my proposal', changes: [change(ids)] }), 'id takes'],
		['no changes', () => ({ id: 'p', changes: [] }), 'at least one'],
		['more than 100 changes', (ids) => ({ id: 'p', changes: many(ids, 101) }), 'at most 100'],
		['an unknown field', (ids) => ({ id: 'p', changes: [change(ids)], note: 'x' }), 'note'],
		[
			'a change without the Category it read',
			(ids) => ({ id: 'p', changes: [{ transactionId: ids.coffee, toCategoryId: ids.dining }] }),
			'changes[0].fromCategoryId'
		],
		[
			'a change with two targets',
			(ids) => ({ id: 'p', changes: [change(ids, { toNewCategory: 'Coffee' })] }),
			'changes[0] needs exactly one'
		],
		[
			'a line that is not a position',
			(ids) => ({ id: 'p', changes: [change(ids, { line: 1.5 })] }),
			'changes[0].line'
		],
		[
			'a change to the Category it has',
			(ids) => ({ id: 'p', changes: [change(ids, { fromCategoryId: ids.dining })] }),
			'changes[0] moves the Transaction to the Category it already has'
		],
		[
			'the same change twice',
			(ids) => ({ id: 'p', changes: [change(ids), change(ids)] }),
			'changes lists'
		],
		[
			'a new Category it does not list',
			(ids) => ({
				id: 'p',
				changes: [change(ids, { toCategoryId: undefined, toNewCategory: 'Coffee' })]
			}),
			'not in newCategories'
		],
		[
			'a new Group it does not list',
			(ids) => ({
				id: 'p',
				newCategories: [{ name: 'Coffee', newGroup: 'Treats' }],
				changes: [change(ids)]
			}),
			'not in newGroups'
		],
		[
			'a new Group listed twice',
			(ids) => ({ id: 'p', newGroups: ['Treats', 'treats'], changes: [change(ids)] }),
			'newGroups lists'
		],
		[
			'a Transaction ID that is not one',
			(ids) => ({ id: 'p', changes: [change(ids, { transactionId: 'not-an-id' })] }),
			'changes[0].transactionId'
		],
		[
			'an Account ID as the target',
			(ids) => ({ id: 'p', changes: [change(ids, { toCategoryId: ids.checking })] }),
			'changes[0].toCategoryId'
		]
	])('refuses %s, naming what is wrong', async (_, bodyOf, mention) => {
		const { t, accounts, categories, read } = await spending();
		const body = bodyOf({
			coffee: idOf(read, 'SAMPLE COFFEE 0042'),
			dining: categories.Dining,
			checking: accounts.Checking
		});

		const response = await t.fetch('/agent/proposals', {
			method: 'POST',
			headers: { authorization: `Bearer ${agentKey}` },
			body: typeof body === 'string' ? body : JSON.stringify(body)
		});

		expect(response.status).toBe(400);
		expect(await response.text()).toContain(mention);
		expect((await rows(t)).get('SAMPLE COFFEE 0042')?.category).toBeNull();
	});

	test.each([
		['a missing id', {}, 'id must be non-empty text'],
		['an unknown field', { id: 'p', changes: [] }, 'unknown field changes']
	])('refuses an undo with %s', async (_, body, mention) => {
		const { t } = await spending();

		const response = await agentPost(t, '/agent/proposals/undo', body);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain(mention);
	});
});

describe('a request body over the size limit', () => {
	function paddedPost(t: Backend, path: string, body: unknown) {
		return t.fetch(path, {
			method: 'POST',
			headers: { authorization: `Bearer ${agentKey}`, 'content-type': 'application/json' },
			body: JSON.stringify(body) + ' '.repeat(64 * 1024)
		});
	}

	test('is refused with 413 before Budge applies or undoes anything', async () => {
		const { t, categories, read } = await spending();
		const coffee = idOf(read, 'SAMPLE COFFEE 0042');
		const proposal = {
			id: 'proposal-padded',
			changes: [{ transactionId: coffee, fromCategoryId: null, toCategoryId: categories.Dining }]
		};

		const applied = await paddedPost(t, '/agent/proposals', proposal);

		expect(applied.status).toBe(413);
		expect(await applied.text()).toContain('larger than 64 KiB');
		expect((await rows(t)).get('SAMPLE COFFEE 0042')?.category).toBeNull();

		await apply(t, proposal);
		const undone = await paddedPost(t, '/agent/proposals/undo', { id: 'proposal-padded' });

		expect(undone.status).toBe(413);
		expect((await rows(t)).get('SAMPLE COFFEE 0042')?.category?.id).toBe(categories.Dining);
	});
});
