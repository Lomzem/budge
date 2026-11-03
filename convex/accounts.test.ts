import { assert, describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import { newBackend, publicErrorCode, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function backendWithCutover() {
	const backend = newBackend();
	await backend.owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	return backend;
}

describe('creating an Account', () => {
	test('lists it with its starting balance', async () => {
		const { owner } = await backendWithCutover();

		await owner.mutation(api.accounts.create, {
			name: 'Checking',
			kind: 'cash',
			startingBalance: 250_000
		});
		await owner.mutation(api.accounts.create, {
			name: 'Card',
			kind: 'creditCard',
			startingBalance: -45_000
		});

		expect(await owner.query(api.accounts.list, {})).toMatchObject([
			{ name: 'Checking', kind: 'cash', balance: 250_000 },
			{ name: 'Card', kind: 'creditCard', balance: -45_000 }
		]);
	});

	test('records the starting balance as a Cleared Transaction on the cutover date', async () => {
		const { owner } = await backendWithCutover();

		const accountId = await owner.mutation(api.accounts.create, {
			name: 'Checking',
			kind: 'cash',
			startingBalance: 250_000
		});

		const { page } = await owner.query(api.transactions.list, {
			accountId,
			paginationOpts: { numItems: 10, cursor: null }
		});
		expect(page).toMatchObject([
			{ date: '2026-08-01', amount: 250_000, payeeName: 'Starting Balance', cleared: true }
		]);
	});

	test('needs the cutover date first', async () => {
		const { owner } = newBackend();

		expect(
			await publicErrorCode(
				owner.mutation(api.accounts.create, { name: 'Checking', kind: 'cash', startingBalance: 0 })
			)
		).toBe('INVALID_INPUT');
	});

	test.each([
		['a blank name', { name: '  ', startingBalance: 0 }],
		['a fractional starting balance', { name: 'Checking', startingBalance: 10.5 }]
	])('rejects %s', async (_, args) => {
		const { owner } = await backendWithCutover();

		expect(
			await publicErrorCode(owner.mutation(api.accounts.create, { kind: 'cash', ...args }))
		).toBe('INVALID_INPUT');
	});
});

describe('renaming and reordering Accounts', () => {
	test('changes how the sidebar reads', async () => {
		const { owner } = await backendWithCutover();
		const create = (name: string) =>
			owner.mutation(api.accounts.create, { name, kind: 'cash', startingBalance: 0 });
		const checking = await create('Checking');
		const savings = await create('Savings');
		const wallet = await create('Wallet');

		await owner.mutation(api.accounts.rename, { accountId: savings, name: ' Rainy Day ' });
		await owner.mutation(api.accounts.reorder, { accountIds: [wallet, checking, savings] });

		const names = (await owner.query(api.accounts.list, {})).map((account) => account.name);
		expect(names).toEqual(['Wallet', 'Checking', 'Rainy Day']);
	});

	test('reordering must name every Account once', async () => {
		const { owner } = await backendWithCutover();
		const create = (name: string) =>
			owner.mutation(api.accounts.create, { name, kind: 'cash', startingBalance: 0 });
		const checking = await create('Checking');
		await create('Savings');

		expect(
			await publicErrorCode(owner.mutation(api.accounts.reorder, { accountIds: [checking] }))
		).toBe('INVALID_INPUT');
		expect(
			await publicErrorCode(
				owner.mutation(api.accounts.reorder, { accountIds: [checking, checking] })
			)
		).toBe('INVALID_INPUT');
	});
});

describe("changing an Account's starting balance", () => {
	async function checkingWithStartingBalance() {
		const backend = await backendWithCutover();
		const accountId = await backend.owner.mutation(api.accounts.create, {
			name: 'Checking',
			kind: 'cash',
			startingBalance: 250_000
		});
		const startingBalances = async () =>
			(
				await backend.owner.query(api.transactions.list, {
					accountId,
					paginationOpts: { numItems: 10, cursor: null }
				})
			).page.filter((row) => row.payeeName === 'Starting Balance');
		return { ...backend, accountId, startingBalances };
	}

	test('after the cutover date moves earlier, replaces the one starting balance on the new date', async () => {
		const { owner, accountId, startingBalances } = await checkingWithStartingBalance();
		await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-07-01' });

		await owner.mutation(api.accounts.setStartingBalance, { accountId, startingBalance: 180_000 });

		expect(await startingBalances()).toMatchObject([{ date: '2026-07-01', amount: 180_000 }]);
		expect((await owner.query(api.accounts.list, {}))[0]?.balance).toBe(180_000);
	});

	test('after a bank row matches the starting balance, still replaces that one starting balance', async () => {
		const { t, owner, accountId, startingBalances } = await checkingWithStartingBalance();
		const [existing] = await startingBalances();
		assert(existing !== undefined, 'expected the starting balance');
		await t.run(async (ctx) => {
			await ctx.db.insert('imports', {
				source: 'csv',
				accountId,
				date: existing.date,
				amount: existing.amount,
				bankText: 'OPENING DEPOSIT',
				transactionId: existing._id,
				matched: true,
				state: 'linked'
			});
		});

		await owner.mutation(api.accounts.setStartingBalance, { accountId, startingBalance: 180_000 });

		expect(await startingBalances()).toMatchObject([{ _id: existing._id, amount: 180_000 }]);
	});

	test('no other Transaction can take the Starting Balance Payee', async () => {
		const { owner, accountId } = await checkingWithStartingBalance();

		expect(
			await publicErrorCode(
				owner.mutation(api.transactions.create, {
					accountId,
					date: '2026-08-02',
					amount: -1_000,
					payee: 'Starting Balance',
					memo: ''
				})
			)
		).toBe('INVALID_INPUT');
	});

	test.each([
		['its Payee', { payee: 'Opening' }],
		['its Account', { moveToSavings: true }]
	])('the starting balance keeps %s', async (_label, change) => {
		const { owner, accountId, startingBalances } = await checkingWithStartingBalance();
		const savingsId = await owner.mutation(api.accounts.create, {
			name: 'Savings',
			kind: 'cash',
			startingBalance: 0
		});
		const [existing] = await startingBalances();
		assert(existing !== undefined, 'expected the starting balance');

		expect(
			await publicErrorCode(
				owner.mutation(api.transactions.update, {
					transactionId: existing._id,
					accountId: 'moveToSavings' in change ? savingsId : accountId,
					date: existing.date,
					amount: existing.amount,
					payee: 'payee' in change ? change.payee : 'Starting Balance',
					memo: ''
				})
			)
		).toBe('INVALID_INPUT');
	});

	test('the Starting Balance Payee keeps its name', async () => {
		const { owner } = await checkingWithStartingBalance();
		const payees = await owner.query(api.payees.list, {});
		const named = (name: string) => payees.find((payee) => payee.name === name)?._id;
		const startingBalance = named('Starting Balance');
		assert(startingBalance !== undefined, 'expected the Payee');

		expect(
			await publicErrorCode(
				owner.mutation(api.payees.rename, { payeeId: startingBalance, name: 'Opening' })
			)
		).toBe('INVALID_INPUT');
	});
});
