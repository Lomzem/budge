import type { FunctionReturnType } from 'convex/server';
import { describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { newBackend, publicErrorCode, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budgetWithTwoAccounts() {
	const backend = newBackend();
	const { owner } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	const checking = await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 100_000
	});
	const card = await owner.mutation(api.accounts.create, {
		name: 'Card',
		kind: 'creditCard',
		startingBalance: 0
	});
	const balanceOf = async (accountId: Id<'accounts'>) =>
		(await owner.query(api.accounts.list, {})).find((account) => account._id === accountId)
			?.balance;
	const page = async (accountId?: Id<'accounts'>) =>
		(
			await owner.query(api.transactions.list, {
				...(accountId === undefined ? {} : { accountId }),
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page;
	return { ...backend, checking, card, balanceOf, page };
}

const groceries = {
	date: '2026-08-14',
	amount: -4_250,
	payee: 'Corner Grocer',
	memo: 'Weekly shop'
};

describe('entering a Transaction by hand', () => {
	test('changes the Account balance and starts uncleared', async () => {
		const { owner, checking, balanceOf, page } = await budgetWithTwoAccounts();

		await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });

		expect(await balanceOf(checking)).toBe(95_750);
		expect((await page(checking))[0]).toMatchObject({
			date: '2026-08-14',
			amount: -4_250,
			payeeName: 'Corner Grocer',
			memo: 'Weekly shop',
			cleared: false
		});
	});

	test('may leave the Payee and memo blank', async () => {
		const { owner, checking, page } = await budgetWithTwoAccounts();

		await owner.mutation(api.transactions.create, {
			accountId: checking,
			...groceries,
			payee: ' ',
			memo: ''
		});

		expect((await page(checking))[0]).toMatchObject({ payeeName: null, memo: null });
	});

	test('creates a Payee on first use and reuses it after', async () => {
		const { t, owner, checking, card } = await budgetWithTwoAccounts();

		await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });
		await owner.mutation(api.transactions.create, {
			accountId: card,
			...groceries,
			payee: ' Corner Grocer '
		});

		const payees = await t.run((ctx) =>
			ctx.db
				.query('payees')
				.withIndex('by_name', (q) => q.eq('name', 'Corner Grocer'))
				.collect()
		);
		expect(payees).toHaveLength(1);
	});

	test.each([
		['a date before the cutover date', { date: '2026-07-31' }],
		['a date that does not exist', { date: '2026-09-31' }],
		['a fractional amount', { amount: -42.5 }],
		['an amount over $10 billion', { amount: -1_000_000_000_001 }]
	])('refuses %s', async (_, change) => {
		const { owner, checking } = await budgetWithTwoAccounts();

		expect(
			await publicErrorCode(
				owner.mutation(api.transactions.create, { accountId: checking, ...groceries, ...change })
			)
		).toBe('INVALID_INPUT');
	});
});

describe('changing a Transaction', () => {
	test('moving it to another Account moves its amount between balances', async () => {
		const { owner, checking, card, balanceOf } = await budgetWithTwoAccounts();
		const id = await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });

		await owner.mutation(api.transactions.update, {
			transactionId: id,
			accountId: card,
			...groceries,
			amount: -5_000
		});

		expect(await balanceOf(checking)).toBe(100_000);
		expect(await balanceOf(card)).toBe(-5_000);
	});

	test('deleting it takes its amount out of the balance', async () => {
		const { owner, checking, balanceOf, page } = await budgetWithTwoAccounts();
		const id = await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });

		await owner.mutation(api.transactions.remove, { transactionId: id });

		expect(await balanceOf(checking)).toBe(100_000);
		expect((await page(checking)).map((row) => row.payeeName)).toEqual(['Starting Balance']);
	});

	test('can be toggled Cleared and back', async () => {
		const { owner, checking, page } = await budgetWithTwoAccounts();
		const id = await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });

		await owner.mutation(api.transactions.setCleared, { transactionId: id, cleared: true });
		expect((await page(checking))[0]?.cleared).toBe(true);

		await owner.mutation(api.transactions.setCleared, { transactionId: id, cleared: false });
		expect((await page(checking))[0]?.cleared).toBe(false);
	});

	test('editing keeps whether it is Cleared', async () => {
		const { owner, checking, page } = await budgetWithTwoAccounts();
		const id = await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });
		await owner.mutation(api.transactions.setCleared, { transactionId: id, cleared: true });

		await owner.mutation(api.transactions.update, {
			transactionId: id,
			accountId: checking,
			...groceries,
			memo: 'Bigger shop'
		});

		expect((await page(checking))[0]).toMatchObject({ memo: 'Bigger shop', cleared: true });
	});

	test('a deleted Transaction is NOT_FOUND', async () => {
		const { owner, checking } = await budgetWithTwoAccounts();
		const id = await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });
		await owner.mutation(api.transactions.remove, { transactionId: id });

		expect(
			await publicErrorCode(owner.mutation(api.transactions.remove, { transactionId: id }))
		).toBe('NOT_FOUND');
	});
});

describe('the Transaction list', () => {
	test('All Accounts shows every Account newest first, named', async () => {
		const { owner, checking, card, page } = await budgetWithTwoAccounts();
		await owner.mutation(api.transactions.create, { accountId: card, ...groceries });
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			...groceries,
			date: '2026-09-02',
			payee: 'Bus Pass Co'
		});

		expect((await page()).map((row) => [row.date, row.accountName, row.payeeName])).toEqual([
			['2026-09-02', 'Checking', 'Bus Pass Co'],
			['2026-08-14', 'Card', 'Corner Grocer'],
			['2026-08-01', 'Card', 'Starting Balance'],
			['2026-08-01', 'Checking', 'Starting Balance']
		]);
	});

	test('pages through an Account without repeats or gaps', async () => {
		const { owner, checking } = await budgetWithTwoAccounts();
		for (let day = 10; day < 17; day++) {
			await owner.mutation(api.transactions.create, {
				accountId: checking,
				...groceries,
				date: `2026-08-${String(day)}`
			});
		}

		const dates: string[] = [];
		let cursor: string | null = null;
		for (;;) {
			const result: FunctionReturnType<typeof api.transactions.list> = await owner.query(
				api.transactions.list,
				{
					accountId: checking,
					paginationOpts: { numItems: 3, cursor }
				}
			);
			dates.push(...result.page.map((row) => row.date));
			if (result.isDone) break;
			cursor = result.continueCursor;
		}

		expect(dates).toEqual([
			'2026-08-16',
			'2026-08-15',
			'2026-08-14',
			'2026-08-13',
			'2026-08-12',
			'2026-08-11',
			'2026-08-10',
			'2026-08-01'
		]);
	});
});

describe('moving the cutover date', () => {
	test('cannot leave a Transaction before it', async () => {
		const { owner } = await budgetWithTwoAccounts();

		expect(
			await publicErrorCode(
				owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-02' })
			)
		).toBe('INVALID_INPUT');
		await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-07-01' });
		expect(await owner.query(api.settings.get, {})).toEqual({ cutoverDate: '2026-07-01' });
	});
});
