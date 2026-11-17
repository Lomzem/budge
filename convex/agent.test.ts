import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import { startBudget, useOwnerEnv } from './test.helper';

useOwnerEnv();

const agentKey = 'agent-key-synthetic-not-real';
const agentKeyFingerprint = createHash('sha256').update(agentKey).digest('hex');

type Backend = Awaited<ReturnType<typeof startBudget>>['t'];

function agentGet(t: Backend, path: string, key: string | null = agentKey) {
	return t.fetch(path, {
		method: 'GET',
		headers: key === null ? {} : { authorization: `Bearer ${key}` }
	});
}

beforeEach(() => {
	vi.stubEnv('BUDGE_AGENT_KEY_SHA256', agentKeyFingerprint);
});

describe('the Agent Key', () => {
	test('admits a request that carries it', async () => {
		const { t } = await startBudget({ accounts: { Checking: ['cash', 120_000] } });

		const response = await agentGet(t, '/agent/accounts');

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			accounts: [
				{
					id: expect.any(String) as unknown,
					name: 'Checking',
					kind: 'cash',
					balance: 1200,
					lastReconciledOn: null
				}
			]
		});
	});

	test.each([
		['no key', null],
		['a different key', 'agent-key-other-not-real'],
		['the fingerprint instead of the key', agentKeyFingerprint]
	])('refuses a request with %s', async (_, key) => {
		const { t } = await startBudget({ accounts: { Checking: ['cash', 120_000] } });

		const response = await agentGet(t, '/agent/accounts', key);

		expect(response.status).toBe(401);
		expect(await response.text()).toBe('');
	});

	test('refuses every key while agent access is off', async () => {
		vi.stubEnv('BUDGE_AGENT_KEY_SHA256', undefined);
		const { t } = await startBudget({ accounts: { Checking: ['cash', 120_000] } });

		expect((await agentGet(t, '/agent/accounts')).status).toBe(401);
	});

	test('refuses a request with a malformed authorization header', async () => {
		const { t } = await startBudget();

		const response = await t.fetch('/agent/accounts', {
			method: 'GET',
			headers: { authorization: agentKey }
		});

		expect(response.status).toBe(401);
	});
});

describe('the agent budget read', () => {
	async function rentBudget() {
		const backend = await startBudget({
			accounts: { Checking: ['cash', 120_000] },
			groups: { Bills: ['Rent'] }
		});
		const { owner, accounts, categories } = backend;
		await owner.mutation(api.categories.setTarget, {
			categoryId: categories.Rent,
			target: { kind: 'monthly', amount: 60_000, mode: 'refill' }
		});
		await owner.mutation(api.budget.setAssigned, {
			month: '2026-08',
			categoryId: categories.Rent,
			amount: 50_000
		});
		await owner.mutation(api.transactions.create, {
			accountId: accounts.Checking,
			date: '2026-08-05',
			amount: -12_345,
			payee: 'Landlord',
			categoryId: categories.Rent,
			memo: ''
		});
		return backend;
	}

	test('reports the month in dollars', async () => {
		const { t, categories } = await rentBudget();

		const response = await agentGet(t, '/agent/budget?month=2026-08&today=2026-08-20');

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			month: '2026-08',
			readyToAssign: { amount: 700, uncategorized: 0 },
			uncategorizedCount: 0,
			groups: [
				{
					name: 'Bills',
					assigned: 500,
					activity: -123.45,
					available: 376.55,
					categories: [
						{
							id: categories.Rent,
							name: 'Rent',
							assigned: 500,
							activity: -123.45,
							available: 376.55,
							target: {
								definition: { kind: 'monthly', amount: 600, mode: 'refill' },
								needed: 100
							}
						}
					]
				}
			]
		});
	});

	test.each([
		['a month that is not YYYY-MM', '/agent/budget?month=August&today=2026-08-20'],
		['a missing month', '/agent/budget?today=2026-08-20'],
		['an impossible date', '/agent/budget?month=2026-08&today=2026-02-30'],
		['a missing date', '/agent/budget?month=2026-08'],
		['an unknown parameter', '/agent/budget?month=2026-08&today=2026-08-20&accountId=x']
	])('refuses %s with a plain message', async (_, path) => {
		const { t } = await startBudget();

		const response = await agentGet(t, path);

		expect(response.status).toBe(400);
		expect(await response.text()).toMatch(/\S/);
	});
});

describe('the agent Transactions read', () => {
	async function checkingHistory() {
		const backend = await startBudget({
			accounts: { Checking: ['cash', 100_000], Savings: ['cash', 50_000] },
			groups: { Everyday: ['Groceries', 'Dining'] }
		});
		const { owner, accounts, categories } = backend;
		const spend = { accountId: accounts.Checking, memo: '' };
		await owner.mutation(api.transactions.create, {
			...spend,
			date: '2026-08-10',
			amount: -6_789,
			payee: 'Corner Grocer',
			categoryId: categories.Groceries,
			memo: 'weekly shop'
		});
		await owner.mutation(api.transactions.create, {
			...spend,
			date: '2026-08-12',
			amount: -10_000,
			payee: 'Market Hall',
			splits: [
				{ categoryId: categories.Groceries, amount: -6_000, memo: 'produce' },
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
		return backend;
	}

	async function readPage(t: Backend, path: string) {
		const response = await agentGet(t, path);
		expect(response.status).toBe(200);
		return (await response.json()) as {
			transactions: { payee: string | null; kind: string }[];
			nextCursor: string | null;
		};
	}

	test('lists an Account newest first in dollars, naming every kind of row', async () => {
		const { t, accounts, categories, readyToAssignId } = await checkingHistory();

		const response = await agentGet(t, `/agent/transactions?accountId=${accounts.Checking}`);

		expect(response.status).toBe(200);
		const checking = { id: accounts.Checking, name: 'Checking' };
		const groceries = { id: categories.Groceries, name: 'Groceries' };
		const base = { account: checking, memo: null, splits: [], bankText: [], transferAccount: null };
		expect(await response.json()).toEqual({
			transactions: [
				{
					...base,
					id: expect.any(String) as unknown,
					date: '2026-08-16',
					kind: 'normal',
					payee: 'SAMPLE COFFEE 0042',
					category: null,
					amount: -4.5,
					cleared: true,
					reconciled: false,
					approved: false,
					bankText: ['SAMPLE COFFEE 0042']
				},
				{
					...base,
					id: expect.any(String) as unknown,
					date: '2026-08-14',
					kind: 'transfer',
					payee: null,
					category: null,
					amount: -200,
					cleared: false,
					reconciled: false,
					approved: true,
					transferAccount: { id: accounts.Savings, name: 'Savings' }
				},
				{
					...base,
					id: expect.any(String) as unknown,
					date: '2026-08-12',
					kind: 'split',
					payee: 'Market Hall',
					category: null,
					amount: -100,
					cleared: false,
					reconciled: false,
					approved: true,
					splits: [
						{ category: groceries, amount: -60, memo: 'produce' },
						{ category: { id: categories.Dining, name: 'Dining' }, amount: -40, memo: null }
					]
				},
				{
					...base,
					id: expect.any(String) as unknown,
					date: '2026-08-10',
					kind: 'normal',
					payee: 'Corner Grocer',
					category: groceries,
					amount: -67.89,
					memo: 'weekly shop',
					cleared: false,
					reconciled: false,
					approved: true
				},
				{
					...base,
					id: expect.any(String) as unknown,
					date: '2026-08-01',
					kind: 'startingBalance',
					payee: 'Starting Balance',
					category: { id: readyToAssignId, name: 'Ready to Assign' },
					amount: 1000,
					cleared: true,
					reconciled: false,
					approved: true
				}
			],
			nextCursor: null
		});
	});

	test('pages with a cursor until the last page', async () => {
		const { t, accounts } = await checkingHistory();
		const path = `/agent/transactions?accountId=${accounts.Checking}&limit=3`;

		const first = await readPage(t, path);
		expect(first.transactions.map((row) => row.kind)).toEqual(['normal', 'transfer', 'split']);
		expect(first.nextCursor).toEqual(expect.any(String));

		const second = await readPage(
			t,
			`${path}&cursor=${encodeURIComponent(first.nextCursor ?? '')}`
		);
		expect(second.transactions.map((row) => row.payee)).toEqual([
			'Corner Grocer',
			'Starting Balance'
		]);
		expect(second.nextCursor).toBeNull();
	});

	test.each([
		['uncategorized=true', ['SAMPLE COFFEE 0042']],
		['approval=unapproved', ['SAMPLE COFFEE 0042']],
		['search=grocer', ['Corner Grocer']],
		['from=2026-08-11&to=2026-08-13', ['Market Hall']]
	])('narrows the list with %s', async (filter, payees) => {
		const { t } = await checkingHistory();

		const page = await readPage(t, `/agent/transactions?${filter}`);

		expect(page.transactions.map((row) => row.payee)).toEqual(payees);
	});

	test('finds split Transactions by a Category one of their lines is in', async () => {
		const { t, categories } = await checkingHistory();

		const page = await readPage(
			t,
			`/agent/transactions?categoryId=${categories.Dining}&splitLines=true`
		);

		expect(page.transactions.map((row) => row.payee)).toEqual(['Market Hall']);
	});

	test.each([
		['a date that is not YYYY-MM-DD', 'from=08/01/2026'],
		['a limit of zero', 'limit=0'],
		['a limit above 100', 'limit=101'],
		['a limit that is not a number', 'limit=ten'],
		['an unknown approval', 'approval=maybe'],
		['uncategorized other than true', 'uncategorized=yes'],
		['a Category and uncategorized together', 'categoryId=CATEGORY&uncategorized=true'],
		['split lines without a Category', 'splitLines=true'],
		['a malformed Account ID', 'accountId=not-an-id'],
		['an ID that names no Account', 'accountId=CATEGORY'],
		['an ID that names no Category', 'categoryId=ACCOUNT'],
		['an unknown parameter', 'month=2026-08']
	])('refuses %s with a plain message', async (_, query) => {
		const { t, accounts, categories } = await startBudget({
			accounts: { Checking: ['cash', 100_000] },
			groups: { Everyday: ['Groceries'] }
		});
		const filled = query
			.replace('CATEGORY', categories.Groceries)
			.replace('ACCOUNT', accounts.Checking);

		const response = await agentGet(t, `/agent/transactions?${filled}`);

		expect(response.status).toBe(400);
		expect(await response.text()).toMatch(/\S/);
	});
});
