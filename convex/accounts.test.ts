import { describe, expect, test } from 'vitest';

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
