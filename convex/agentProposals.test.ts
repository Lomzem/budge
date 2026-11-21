import { createHash } from 'node:crypto';

import { assert, beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { startBudget, useOwnerEnv } from './test.helper';

useOwnerEnv();

const agentKey = 'agent-key-synthetic-not-real';

type Backend = Awaited<ReturnType<typeof startBudget>>['t'];

interface Row {
	id: string;
	revision: string;
	date: string;
	kind: string;
	account: { id: string; name: string };
	payee: string | null;
	category: { id: string; name: string } | null;
	amount: number;
	memo: string | null;
	cleared: boolean;
	reconciled: boolean;
	approved: boolean;
	transferAccount: { id: string; name: string } | null;
	splits: { category: { id: string }; amount: number }[];
	bankText: string[];
}

interface BudgetView {
	readyToAssign: { id: string | null; amount: number; uncategorized: number };
	uncategorizedCount: number;
	groups: {
		kind: string;
		categories: { id: string; name: string; activity: number; available: number }[];
	}[];
}

beforeEach(() => {
	vi.stubEnv('BUDGE_AGENT_KEY_SHA256', createHash('sha256').update(agentKey).digest('hex'));
});

function agentGet(t: Backend, path: string) {
	return t.fetch(path, {
		method: 'GET',
		headers: { authorization: `Bearer ${agentKey}` }
	});
}

function agentPost(t: Backend, path: string, body: unknown) {
	return t.fetch(path, {
		method: 'POST',
		headers: { authorization: `Bearer ${agentKey}`, 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

async function listRows(t: Backend, query = '') {
	const response = await agentGet(t, `/agent/transactions${query}`);
	expect(response.status).toBe(200);
	return ((await response.json()) as { transactions: Row[] }).transactions;
}

async function rows(t: Backend) {
	const transactions = await listRows(t);
	return new Map(transactions.map((row) => [row.payee ?? 'transfer', row]));
}

async function budgetOf(t: Backend, month = '2026-08', today = '2026-08-31') {
	const response = await agentGet(t, `/agent/budget?month=${month}&today=${today}`);
	expect(response.status).toBe(200);
	return (await response.json()) as BudgetView;
}

async function accountsOf(t: Backend) {
	const response = await agentGet(t, '/agent/accounts');
	expect(response.status).toBe(200);
	const { accounts } = (await response.json()) as {
		accounts: { id: string; name: string; balance: number }[];
	};
	return Object.fromEntries(accounts.map((account) => [account.name, account.balance]));
}

async function apply(t: Backend, proposal: unknown) {
	const response = await agentPost(t, '/agent/proposals', proposal);
	expect(response.status).toBe(200);
	return (await response.json()) as {
		changes: { transactionId: string; outcome: string }[];
		transfers: { firstTransactionId: string; secondTransactionId: string; outcome: string }[];
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
			expect(after.get(payee)).toEqual({
				...read.get(payee),
				revision: expect.any(String) as unknown,
				category: dining
			});
			expect(after.get(payee)?.revision).not.toBe(read.get(payee)?.revision);
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
		grocer: string;
		transfer: string;
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
		],
		[
			'a transfer naming the same Transaction twice',
			(ids) => ({
				id: 'p',
				transfers: [
					{
						first: { transactionId: ids.coffee, revision: 'rev-1' },
						second: { transactionId: ids.coffee, revision: 'rev-1' }
					}
				]
			}),
			'two different Transactions'
		],
		[
			'two transfers naming the same Transaction',
			(ids) => ({
				id: 'p',
				transfers: [
					{
						first: { transactionId: ids.coffee, revision: 'rev-1' },
						second: { transactionId: ids.grocer, revision: 'rev-2' }
					},
					{
						first: { transactionId: ids.coffee, revision: 'rev-1' },
						second: { transactionId: ids.transfer, revision: 'rev-3' }
					}
				]
			}),
			'transfers lists'
		],
		[
			'a Transaction listed in both changes and transfers',
			(ids) => ({
				id: 'p',
				changes: [change(ids)],
				transfers: [
					{
						first: { transactionId: ids.coffee, revision: 'rev-1' },
						second: { transactionId: ids.grocer, revision: 'rev-2' }
					}
				]
			}),
			'changes and transfers both list'
		],
		[
			'more than 100 combined changes and transfers',
			(ids) => ({
				id: 'p',
				changes: many(ids, 100),
				transfers: [
					{
						first: { transactionId: ids.grocer, revision: 'rev-2' },
						second: { transactionId: ids.transfer, revision: 'rev-3' }
					}
				]
			}),
			'at most 100'
		],
		[
			'a transfer with a malformed Transaction ID',
			(ids) => ({
				id: 'p',
				transfers: [
					{
						first: { transactionId: 'not-an-id', revision: 'rev-1' },
						second: { transactionId: ids.coffee, revision: 'rev-2' }
					}
				]
			}),
			'transfers[0].first.transactionId'
		],
		[
			'a transfer missing a revision',
			(ids) => ({
				id: 'p',
				transfers: [
					{
						first: { transactionId: ids.coffee, revision: 'rev-1' },
						second: { transactionId: ids.grocer }
					}
				]
			}),
			'transfers[0].second.revision'
		]
	])('refuses %s, naming what is wrong', async (_, bodyOf, mention) => {
		const { t, accounts, categories, read } = await spending();
		const body = bodyOf({
			coffee: idOf(read, 'SAMPLE COFFEE 0042'),
			grocer: idOf(read, 'Corner Grocer'),
			transfer: idOf(read, 'transfer'),
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

describe('moving an inflow to Ready to Assign', () => {
	async function budgetWithInflow() {
		const backend = await startBudget({
			accounts: { Checking: ['cash', 100_000], Discover: ['creditCard', -40_000] },
			groups: { Everyday: ['Groceries', 'Dining'] }
		});
		const { owner, accounts } = backend;
		await owner.mutation(api.imports.commit, {
			accountId: accounts.Checking,
			source: 'csv',
			rows: [{ date: '2026-08-18', amount: 10_000, bankText: 'SAMPLE GIFT 0001' }]
		});
		return backend;
	}

	test('moves an Uncategorized inflow to Ready to Assign, updates reads, and undoes cleanly', async () => {
		const { t, readyToAssignId } = await budgetWithInflow();
		const beforeBudget = await budgetOf(t);
		expect(beforeBudget.readyToAssign).toEqual({
			id: readyToAssignId,
			amount: 1100,
			uncategorized: 100
		});
		expect(beforeBudget.uncategorizedCount).toBe(1);
		const gift = idOf(await rows(t), 'SAMPLE GIFT 0001');

		const result = await apply(t, {
			id: 'inflow-rta',
			changes: [
				{ transactionId: gift, fromCategoryId: null, toCategoryId: beforeBudget.readyToAssign.id }
			]
		});

		expect(result.changes.map((change) => change.outcome)).toEqual(['applied']);
		expect((await rows(t)).get('SAMPLE GIFT 0001')).toMatchObject({
			category: { id: readyToAssignId, name: 'Ready to Assign' },
			approved: false
		});
		expect(await listRows(t, '?uncategorized=true')).toEqual([]);
		const afterBudget = await budgetOf(t);
		expect(afterBudget.readyToAssign).toEqual({
			id: readyToAssignId,
			amount: 1100,
			uncategorized: 0
		});
		expect(afterBudget.uncategorizedCount).toBe(0);

		const undone = await agentPost(t, '/agent/proposals/undo', { id: 'inflow-rta' });
		expect(undone.status).toBe(200);
		expect(await undone.json()).toEqual({
			id: 'inflow-rta',
			restored: 1,
			keptTransactionIds: [],
			removedCategories: [],
			removedGroups: []
		});
		expect((await rows(t)).get('SAMPLE GIFT 0001')).toMatchObject({
			category: null,
			approved: false
		});
		expect((await budgetOf(t)).readyToAssign.uncategorized).toBe(100);
		expect((await budgetOf(t)).uncategorizedCount).toBe(1);
	});

	test('keeps a later owner edit when undoing an inflow moved to Ready to Assign', async () => {
		const { t, owner, categories, readyToAssignId } = await budgetWithInflow();
		const gift = idOf(await rows(t), 'SAMPLE GIFT 0001') as Id<'transactions'>;
		await apply(t, {
			id: 'inflow-rta-edited',
			changes: [{ transactionId: gift, fromCategoryId: null, toCategoryId: readyToAssignId }]
		});
		await owner.mutation(api.transactions.categorize, {
			transactionId: gift,
			choice: { kind: 'category', categoryId: categories.Groceries }
		});

		const undone = await agentPost(t, '/agent/proposals/undo', { id: 'inflow-rta-edited' });
		expect(undone.status).toBe(200);
		expect(await undone.json()).toMatchObject({ restored: 0, keptTransactionIds: [gift] });
		expect((await rows(t)).get('SAMPLE GIFT 0001')?.category?.id).toBe(categories.Groceries);
	});

	test('still refuses a Credit Card Payment Category on an inflow and Ready to Assign on an outflow split line', async () => {
		const { t, owner, accounts, categories, readyToAssignId } = await budgetWithInflow();
		const paymentCategory = (await budgetOf(t)).groups.find(
			(group) => group.kind === 'creditCardPayments'
		)?.categories[0]?.id;
		assert(paymentCategory !== undefined, 'Discover Payment Category missing');
		const splitId = await owner.mutation(api.transactions.create, {
			accountId: accounts.Checking,
			date: '2026-08-19',
			amount: 5_000,
			payee: 'Mixed Deposit',
			memo: '',
			splits: [
				{ categoryId: categories.Groceries, amount: 8_000, memo: '' },
				{ categoryId: categories.Dining, amount: -3_000, memo: '' }
			]
		});
		const gift = idOf(await rows(t), 'SAMPLE GIFT 0001');

		const result = await apply(t, {
			id: 'inflow-guards',
			changes: [
				{ transactionId: gift, fromCategoryId: null, toCategoryId: paymentCategory },
				{
					transactionId: splitId,
					line: 0,
					fromCategoryId: categories.Groceries,
					toCategoryId: readyToAssignId
				},
				{
					transactionId: splitId,
					line: 1,
					fromCategoryId: categories.Dining,
					toCategoryId: readyToAssignId
				}
			]
		});

		expect(result.changes.map((change) => change.outcome)).toEqual([
			'notAllowed',
			'applied',
			'notAllowed'
		]);
		const after = await rows(t);
		expect(after.get('SAMPLE GIFT 0001')?.category).toBeNull();
		expect(after.get('Mixed Deposit')?.splits.map((line) => line.category.id)).toEqual([
			readyToAssignId,
			categories.Dining
		]);
	});
});

describe('linking imported Transactions as a Transfer', () => {
	interface SideRef {
		transactionId: Id<'transactions'>;
		revision: string;
	}

	async function sideOf(t: Backend, transactionId: Id<'transactions'>): Promise<SideRef> {
		const found = (await listRows(t)).find((row) => row.id === transactionId);
		assert(found !== undefined, `no row for ${transactionId}`);
		return { transactionId, revision: found.revision };
	}

	async function cardPaymentSetup(
		dates: { checking: string; card: string } = { checking: '2026-08-20', card: '2026-08-21' }
	) {
		const backend = await startBudget({
			accounts: {
				Checking: ['cash', 100_000],
				Savings: ['cash', 50_000],
				Discover: ['creditCard', -40_000],
				Visa: ['creditCard', -20_000]
			},
			groups: { Everyday: ['Groceries', 'Dining'] }
		});
		const { owner, accounts } = backend;
		await owner.mutation(api.imports.commit, {
			accountId: accounts.Checking,
			source: 'csv',
			rows: [{ date: dates.checking, amount: -25_000, bankText: 'SAMPLE CARD PAYOUT' }]
		});
		await owner.mutation(api.imports.commit, {
			accountId: accounts.Discover,
			source: 'csv',
			rows: [{ date: dates.card, amount: 25_000, bankText: 'SAMPLE PAYMENT THANK YOU' }]
		});
		const read = await rows(backend.t);
		const checkingRow = read.get('SAMPLE CARD PAYOUT');
		const cardRow = read.get('SAMPLE PAYMENT THANK YOU');
		assert(checkingRow !== undefined && cardRow !== undefined, 'imports missing');
		const fromChecking = checkingRow.id as Id<'transactions'>;
		const intoCard = cardRow.id as Id<'transactions'>;
		return {
			...backend,
			fromChecking,
			intoCard,
			firstSide: { transactionId: fromChecking, revision: checkingRow.revision },
			secondSide: { transactionId: intoCard, revision: cardRow.revision }
		};
	}

	async function readsSnapshot(t: Backend, months: readonly string[]) {
		return {
			accounts: await accountsOf(t),
			budgets: await Promise.all(months.map((month) => budgetOf(t, month, `${month}-28`)))
		};
	}

	test('links a card payment pair one day apart, preserving balances, Bank Rows, and budget totals', async () => {
		const { t, accounts, fromChecking, intoCard, firstSide, secondSide } = await cardPaymentSetup();
		const balancesBefore = await accountsOf(t);

		const result = await apply(t, {
			id: 'link-card-payment',
			transfers: [{ first: firstSide, second: secondSide }]
		});

		expect(result.transfers).toEqual([
			{ firstTransactionId: fromChecking, secondTransactionId: intoCard, outcome: 'applied' }
		]);
		expect(await accountsOf(t)).toEqual(balancesBefore);
		expect(await listRows(t, '?uncategorized=true')).toEqual([]);

		const checkingRows = await listRows(t, `?accountId=${accounts.Checking}`);
		expect(checkingRows.find((row) => row.id === fromChecking)).toMatchObject({
			id: fromChecking,
			date: '2026-08-20',
			kind: 'transfer',
			payee: null,
			category: null,
			amount: -250,
			cleared: true,
			approved: false,
			transferAccount: { id: accounts.Discover, name: 'Discover' },
			bankText: ['SAMPLE CARD PAYOUT']
		});
		const cardRows = await listRows(t, `?accountId=${accounts.Discover}`);
		expect(cardRows.find((row) => row.id === intoCard)).toMatchObject({
			id: intoCard,
			date: '2026-08-20',
			kind: 'transfer',
			payee: null,
			category: null,
			amount: 250,
			cleared: true,
			approved: false,
			transferAccount: { id: accounts.Checking, name: 'Checking' },
			bankText: ['SAMPLE PAYMENT THANK YOU']
		});

		const linkedImports = await t.run((ctx) => ctx.db.query('imports').collect());
		expect(
			linkedImports.map(({ transactionId, bankText, state }) => ({
				transactionId,
				bankText,
				state
			}))
		).toEqual([
			{ transactionId: fromChecking, bankText: 'SAMPLE CARD PAYOUT', state: 'linked' },
			{ transactionId: intoCard, bankText: 'SAMPLE PAYMENT THANK YOU', state: 'linked' }
		]);

		const budget = await budgetOf(t);
		expect(budget.uncategorizedCount).toBe(0);
		expect(budget.readyToAssign.uncategorized).toBe(0);
		const discoverPayment = budget.groups
			.find((group) => group.kind === 'creditCardPayments')
			?.categories.find((category) => category.name === 'Discover');
		expect(discoverPayment).toMatchObject({ activity: -250, available: -250 });

		const beforeRebuild = await readsSnapshot(t, ['2026-08']);
		await t.mutation(internal.monthlyTotals.rebuild, {});
		expect(await readsSnapshot(t, ['2026-08'])).toEqual(beforeRebuild);

		const recent = await agentGet(t, '/agent/proposals');
		expect(await recent.json()).toMatchObject({
			proposals: [{ id: 'link-card-payment', applied: 1, refused: 0, undone: false }]
		});
	});

	type CardSetup = Awaited<ReturnType<typeof cardPaymentSetup>>;
	test.each<[string, (setup: CardSetup) => Promise<{ first: SideRef; second: SideRef }>, string]>([
		[
			'a side whose Category changed since read',
			async ({ owner, categories, intoCard, firstSide, secondSide }) => {
				await owner.mutation(api.transactions.categorize, {
					transactionId: intoCard,
					choice: { kind: 'category', categoryId: categories.Groceries }
				});
				return { first: firstSide, second: secondSide };
			},
			'changed'
		],
		[
			'a second side given a memo by the owner since read',
			async ({ owner, accounts, intoCard, firstSide, secondSide }) => {
				await owner.mutation(api.transactions.update, {
					transactionId: intoCard,
					accountId: accounts.Discover,
					date: '2026-08-21',
					amount: 25_000,
					payee: 'SAMPLE PAYMENT THANK YOU',
					memo: 'Owner note to keep'
				});
				return { first: firstSide, second: secondSide };
			},
			'changed'
		],
		[
			'a side whose Bank Text changed since read',
			async ({ t, intoCard, firstSide, secondSide }) => {
				await t.run(async (ctx) => {
					const row = await ctx.db
						.query('imports')
						.withIndex('by_transactionId_state', (q) => q.eq('transactionId', intoCard))
						.first();
					assert(row !== null, 'bank row missing');
					await ctx.db.patch('imports', row._id, { bankText: 'SAMPLE REVISED BANK TEXT' });
				});
				return { first: firstSide, second: secondSide };
			},
			'changed'
		],
		[
			'a side deleted since read',
			async ({ owner, intoCard, firstSide, secondSide }) => {
				await owner.mutation(api.transactions.remove, { transactionId: intoCard });
				return { first: firstSide, second: secondSide };
			},
			'changed'
		],
		[
			'a side already linked as a Transfer',
			async ({ owner, accounts, fromChecking, firstSide, secondSide }) => {
				await owner.mutation(api.transactions.categorize, {
					transactionId: fromChecking,
					choice: { kind: 'transfer', accountId: accounts.Savings }
				});
				return { first: firstSide, second: secondSide };
			},
			'transfer'
		],
		[
			'a Starting Balance',
			async ({ t, accounts, secondSide }) => {
				const checkingRows = await listRows(t, `?accountId=${accounts.Checking}`);
				const starting = checkingRows.find((row) => row.kind === 'startingBalance');
				assert(starting !== undefined, 'Starting Balance missing');
				return {
					first: { transactionId: starting.id as Id<'transactions'>, revision: starting.revision },
					second: secondSide
				};
			},
			'startingBalance'
		],
		[
			'a Split Transaction',
			async ({ owner, accounts, categories, intoCard, firstSide, secondSide }) => {
				await owner.mutation(api.transactions.update, {
					transactionId: intoCard,
					accountId: accounts.Discover,
					date: '2026-08-21',
					amount: 25_000,
					payee: 'Split Payment',
					memo: '',
					splits: [
						{ categoryId: categories.Groceries, amount: 20_000, memo: '' },
						{ categoryId: categories.Dining, amount: 5_000, memo: '' }
					]
				});
				return { first: firstSide, second: secondSide };
			},
			'split'
		],
		[
			'a manual Transaction with no Bank Row',
			async ({ t, owner, accounts, firstSide }) => {
				const manual = await owner.mutation(api.transactions.create, {
					accountId: accounts.Discover,
					date: '2026-08-21',
					amount: 25_000,
					payee: 'Manual Payment',
					memo: ''
				});
				return { first: firstSide, second: await sideOf(t, manual) };
			},
			'notEligible'
		],
		[
			'opposite Accounts with amounts that do not cancel',
			async ({ t, owner, accounts, firstSide }) => {
				await owner.mutation(api.imports.commit, {
					accountId: accounts.Discover,
					source: 'csv',
					rows: [{ date: '2026-08-21', amount: 20_000, bankText: 'SAMPLE SHORT PAY' }]
				});
				const other = idOf(await rows(t), 'SAMPLE SHORT PAY') as Id<'transactions'>;
				return { first: firstSide, second: await sideOf(t, other) };
			},
			'notEligible'
		],
		[
			'dates more than 10 days apart',
			async ({ t, owner, accounts, firstSide }) => {
				await owner.mutation(api.imports.commit, {
					accountId: accounts.Discover,
					source: 'csv',
					rows: [{ date: '2026-08-31', amount: 25_000, bankText: 'SAMPLE LATE PAY' }]
				});
				const other = idOf(await rows(t), 'SAMPLE LATE PAY') as Id<'transactions'>;
				return { first: firstSide, second: await sideOf(t, other) };
			},
			'notEligible'
		],
		[
			'a card payment moving money into Cash instead of out of Cash',
			async ({ t, owner, accounts }) => {
				await owner.mutation(api.imports.commit, {
					accountId: accounts.Checking,
					source: 'csv',
					rows: [{ date: '2026-08-20', amount: 15_000, bankText: 'SAMPLE CASH IN' }]
				});
				await owner.mutation(api.imports.commit, {
					accountId: accounts.Discover,
					source: 'csv',
					rows: [{ date: '2026-08-21', amount: -15_000, bankText: 'SAMPLE CARD OUT' }]
				});
				const read = await rows(t);
				return {
					first: await sideOf(t, idOf(read, 'SAMPLE CASH IN') as Id<'transactions'>),
					second: await sideOf(t, idOf(read, 'SAMPLE CARD OUT') as Id<'transactions'>)
				};
			},
			'notEligible'
		],
		[
			'two Credit Card Accounts',
			async ({ t, owner, accounts, secondSide }) => {
				await owner.mutation(api.imports.commit, {
					accountId: accounts.Visa,
					source: 'csv',
					rows: [{ date: '2026-08-21', amount: -25_000, bankText: 'SAMPLE VISA OUT' }]
				});
				const other = idOf(await rows(t), 'SAMPLE VISA OUT') as Id<'transactions'>;
				return { first: await sideOf(t, other), second: secondSide };
			},
			'notEligible'
		],
		[
			'two Transactions in the same Account',
			async ({ t, owner, accounts, firstSide }) => {
				await owner.mutation(api.imports.commit, {
					accountId: accounts.Checking,
					source: 'csv',
					rows: [{ date: '2026-08-21', amount: 25_000, bankText: 'SAMPLE SAME ACCT' }]
				});
				const other = idOf(await rows(t), 'SAMPLE SAME ACCT') as Id<'transactions'>;
				return { first: firstSide, second: await sideOf(t, other) };
			},
			'notEligible'
		],
		[
			'a Reconciled second side with a different date',
			async ({ t, owner, accounts, intoCard, firstSide }) => {
				await owner.mutation(api.reconciliation.reconcile, {
					accountId: accounts.Discover,
					balance: -15_000,
					date: '2026-08-31'
				});
				return { first: firstSide, second: await sideOf(t, intoCard) };
			},
			'notEligible'
		]
	])(
		'refuses to link %s and leaves both sides as they were',
		async (_, prepare, expectedOutcome) => {
			const setup = await cardPaymentSetup();
			const { t } = setup;
			const { first, second } = await prepare(setup);
			const beforeFirst = (await listRows(t)).find((row) => row.id === first.transactionId);
			const beforeSecond = (await listRows(t)).find((row) => row.id === second.transactionId);

			const result = await apply(t, {
				id: 'transfer-conflict',
				transfers: [{ first, second }]
			});

			expect(result.transfers).toEqual([
				{
					firstTransactionId: first.transactionId,
					secondTransactionId: second.transactionId,
					outcome: expectedOutcome
				}
			]);
			const afterRows = await listRows(t);
			expect(afterRows.find((row) => row.id === first.transactionId)).toEqual(beforeFirst);
			expect(afterRows.find((row) => row.id === second.transactionId)).toEqual(beforeSecond);
		}
	);

	test('replays a transfer proposal by id without re-linking after an owner edit', async () => {
		const { t, owner, categories, fromChecking, firstSide, secondSide } = await cardPaymentSetup();
		const proposal = {
			id: 'transfer-replay',
			transfers: [{ first: firstSide, second: secondSide }]
		};
		const firstResult = await apply(t, proposal);
		await owner.mutation(api.transactions.categorize, {
			transactionId: fromChecking,
			choice: { kind: 'category', categoryId: categories.Groceries }
		});

		const replay = await apply(t, proposal);

		expect(replay).toEqual(firstResult);
		expect((await listRows(t)).find((row) => row.id === fromChecking)).toMatchObject({
			kind: 'normal',
			category: { id: categories.Groceries }
		});
	});

	test('undoes a linked Transfer across a month boundary, restoring both sides, Bank Rows, and totals', async () => {
		const { t, accounts, fromChecking, intoCard, firstSide, secondSide } = await cardPaymentSetup({
			checking: '2026-08-31',
			card: '2026-09-01'
		});
		const balancesBefore = await accountsOf(t);
		await apply(t, {
			id: 'transfer-cross-month',
			transfers: [{ first: firstSide, second: secondSide }]
		});

		const firstUndo = await agentPost(t, '/agent/proposals/undo', { id: 'transfer-cross-month' });
		expect(firstUndo.status).toBe(200);
		const firstUndoBody = (await firstUndo.json()) as unknown;
		expect(firstUndoBody).toEqual({
			id: 'transfer-cross-month',
			restored: 1,
			keptTransactionIds: [],
			removedCategories: [],
			removedGroups: []
		});

		const checkingRow = (await listRows(t, `?accountId=${accounts.Checking}`)).find(
			(row) => row.id === fromChecking
		);
		const cardRow = (await listRows(t, `?accountId=${accounts.Discover}`)).find(
			(row) => row.id === intoCard
		);
		expect(checkingRow).toMatchObject({
			date: '2026-08-31',
			kind: 'normal',
			payee: 'SAMPLE CARD PAYOUT',
			category: null,
			amount: -250,
			cleared: true,
			approved: false,
			transferAccount: null,
			bankText: ['SAMPLE CARD PAYOUT']
		});
		expect(cardRow).toMatchObject({
			date: '2026-09-01',
			kind: 'normal',
			payee: 'SAMPLE PAYMENT THANK YOU',
			category: null,
			amount: 250,
			cleared: true,
			approved: false,
			transferAccount: null,
			bankText: ['SAMPLE PAYMENT THANK YOU']
		});
		expect(await accountsOf(t)).toEqual(balancesBefore);
		expect((await listRows(t, '?uncategorized=true')).map((row) => row.id).sort()).toEqual(
			[fromChecking, intoCard].sort()
		);

		const readsAfterUndo = await readsSnapshot(t, ['2026-08', '2026-09']);
		await t.mutation(internal.monthlyTotals.rebuild, {});
		expect(await readsSnapshot(t, ['2026-08', '2026-09'])).toEqual(readsAfterUndo);

		const secondUndo = await agentPost(t, '/agent/proposals/undo', { id: 'transfer-cross-month' });
		expect(secondUndo.status).toBe(200);
		expect(await secondUndo.json()).toEqual(firstUndoBody);
	});

	test('keeps a linked Transfer on undo when the owner moved cutover past an original side date', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-11-17T18:00:00Z'));
		onTestFinished(() => {
			vi.useRealTimers();
		});
		const { t, owner, fromChecking, intoCard, firstSide, secondSide } = await cardPaymentSetup({
			checking: '2026-08-31',
			card: '2026-09-01'
		});
		await apply(t, {
			id: 'transfer-before-cutover-move',
			transfers: [{ first: secondSide, second: firstSide }]
		});
		const later = { cutoverDate: '2026-09-01', today: '2026-11-17' };
		const preview = await owner.query(api.settings.previewLaterCutover, later);
		assert(preview.kind === 'ready', `expected a ready preview, got ${preview.kind}`);
		await owner.mutation(api.settings.applyLaterCutover, {
			...later,
			fingerprint: preview.fingerprint,
			unlockReconciled: true
		});

		const undone = await agentPost(t, '/agent/proposals/undo', {
			id: 'transfer-before-cutover-move'
		});

		expect(undone.status).toBe(200);
		expect(await undone.json()).toEqual({
			id: 'transfer-before-cutover-move',
			restored: 0,
			keptTransactionIds: [intoCard, fromChecking],
			removedCategories: [],
			removedGroups: []
		});
		const afterRows = await listRows(t);
		expect(afterRows.find((row) => row.id === fromChecking)).toMatchObject({
			kind: 'transfer',
			date: '2026-09-01'
		});
		expect(afterRows.find((row) => row.id === intoCard)).toMatchObject({
			kind: 'transfer',
			date: '2026-09-01'
		});
	});

	test('keeps a linked Transfer on undo when the owner kept an already-approved side after bank removal', async () => {
		const { t, owner, fromChecking, intoCard } = await cardPaymentSetup();
		await owner.mutation(api.transactions.approve, { transactionId: fromChecking });
		await owner.mutation(api.transactions.approve, { transactionId: intoCard });
		await apply(t, {
			id: 'transfer-bank-removed',
			transfers: [{ first: await sideOf(t, fromChecking), second: await sideOf(t, intoCard) }]
		});
		const bankRow = await t.run(async (ctx) => {
			const row = await ctx.db
				.query('imports')
				.withIndex('by_transactionId_state', (q) => q.eq('transactionId', fromChecking))
				.first();
			assert(row !== null, 'bank row missing');
			await ctx.db.patch('imports', row._id, { state: 'removed' });
			return row._id;
		});
		await owner.mutation(api.imports.resolveBankChange, { importId: bankRow, keep: 'mine' });

		const undone = await agentPost(t, '/agent/proposals/undo', { id: 'transfer-bank-removed' });

		expect(undone.status).toBe(200);
		expect(await undone.json()).toEqual({
			id: 'transfer-bank-removed',
			restored: 0,
			keptTransactionIds: [fromChecking, intoCard],
			removedCategories: [],
			removedGroups: []
		});
		expect((await listRows(t)).find((row) => row.id === fromChecking)).toMatchObject({
			kind: 'transfer',
			bankText: []
		});
	});

	test('keeps a linked Transfer on undo when the owner kept an already-approved side after a bank date change', async () => {
		const { t, owner, fromChecking, intoCard } = await cardPaymentSetup();
		await owner.mutation(api.transactions.approve, { transactionId: fromChecking });
		await owner.mutation(api.transactions.approve, { transactionId: intoCard });
		await apply(t, {
			id: 'transfer-bank-date-changed',
			transfers: [{ first: await sideOf(t, fromChecking), second: await sideOf(t, intoCard) }]
		});
		const bankRow = await t.run(async (ctx) => {
			const row = await ctx.db
				.query('imports')
				.withIndex('by_transactionId_state', (q) => q.eq('transactionId', intoCard))
				.first();
			assert(row !== null, 'bank row missing');
			await ctx.db.patch('imports', row._id, { date: '2026-08-23', state: 'changed' });
			return row._id;
		});
		await owner.mutation(api.imports.resolveBankChange, { importId: bankRow, keep: 'mine' });

		const undone = await agentPost(t, '/agent/proposals/undo', {
			id: 'transfer-bank-date-changed'
		});

		expect(undone.status).toBe(200);
		expect(await undone.json()).toEqual({
			id: 'transfer-bank-date-changed',
			restored: 0,
			keptTransactionIds: [fromChecking, intoCard],
			removedCategories: [],
			removedGroups: []
		});
		expect((await listRows(t)).find((row) => row.id === intoCard)).toMatchObject({
			kind: 'transfer',
			date: '2026-08-20'
		});
	});

	test.each<[string, (setup: CardSetup) => Promise<unknown>]>([
		[
			'edits the memo',
			({ owner, accounts, fromChecking, intoCard }) =>
				owner.mutation(api.transactions.update, {
					transactionId: fromChecking,
					accountId: accounts.Checking,
					date: '2026-08-20',
					amount: -25_000,
					payee: '',
					memo: 'August statement',
					transferAccountId: accounts.Discover,
					transferTransactionId: intoCard
				})
		],
		[
			'approves one side',
			({ owner, fromChecking }) =>
				owner.mutation(api.transactions.approve, { transactionId: fromChecking })
		],
		[
			'changes the date',
			({ owner, accounts, fromChecking, intoCard }) =>
				owner.mutation(api.transactions.update, {
					transactionId: fromChecking,
					accountId: accounts.Checking,
					date: '2026-08-22',
					amount: -25_000,
					payee: '',
					memo: '',
					transferAccountId: accounts.Discover,
					transferTransactionId: intoCard
				})
		],
		[
			'recategorizes the Transfer',
			({ owner, categories, fromChecking }) =>
				owner.mutation(api.transactions.categorize, {
					transactionId: fromChecking,
					choice: { kind: 'category', categoryId: categories.Groceries }
				})
		],
		[
			'reconciles one side',
			({ owner, accounts }) =>
				owner.mutation(api.reconciliation.reconcile, {
					accountId: accounts.Discover,
					balance: -15_000,
					date: '2026-08-31'
				})
		]
	])('preserves the pair on undo when the owner %s', async (_, ownerEdit) => {
		const setup = await cardPaymentSetup();
		const { t, fromChecking, intoCard, firstSide, secondSide } = setup;
		await apply(t, {
			id: 'transfer-owner-edit',
			transfers: [{ first: firstSide, second: secondSide }]
		});
		await ownerEdit(setup);
		const beforeUndoFirst = (await listRows(t)).find((row) => row.id === fromChecking);
		const beforeUndoSecond = (await listRows(t)).find((row) => row.id === intoCard);

		const undone = await agentPost(t, '/agent/proposals/undo', { id: 'transfer-owner-edit' });

		expect(undone.status).toBe(200);
		expect(await undone.json()).toEqual({
			id: 'transfer-owner-edit',
			restored: 0,
			keptTransactionIds: [fromChecking, intoCard],
			removedCategories: [],
			removedGroups: []
		});
		const afterRows = await listRows(t);
		expect(afterRows.find((row) => row.id === fromChecking)).toEqual(beforeUndoFirst);
		expect(afterRows.find((row) => row.id === intoCard)).toEqual(beforeUndoSecond);
	});
});
