import { describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { newBackend, publicErrorCode, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budgetWithCard() {
	const backend = newBackend();
	const { owner } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	const checking = await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 300_000
	});
	const discover = await owner.mutation(api.accounts.create, {
		name: 'Discover',
		kind: 'creditCard',
		startingBalance: -20_000
	});
	const everyday = await owner.mutation(api.categories.createGroup, { name: 'Everyday' });
	const groceries = await owner.mutation(api.categories.create, {
		groupId: everyday,
		name: 'Groceries'
	});
	const dining = await owner.mutation(api.categories.create, {
		groupId: everyday,
		name: 'Dining Out'
	});

	const buy = (date: string, amount: number, categoryId?: Id<'categories'>) =>
		owner.mutation(api.transactions.create, {
			accountId: discover,
			date,
			amount,
			payee: 'Sample Grocer',
			...(categoryId === undefined ? {} : { categoryId }),
			memo: ''
		});
	const assign = (categoryId: Id<'categories'>, amount: number) =>
		owner.mutation(api.budget.setAssigned, { month: '2026-08', categoryId, amount });
	const view = () => owner.query(api.budget.month, { month: '2026-08', today: '2026-08-31' });
	const row = async (name: string) => {
		const found = (await view()).groups.flatMap((g) => g.categories).find((c) => c.name === name);
		if (found === undefined) throw new Error(`No Category named ${name}`);
		return found;
	};
	return { ...backend, checking, discover, groceries, dining, buy, assign, view, row };
}

describe('creating a Credit Card Account', () => {
	test('creates its Payment Category in the Credit Card Payments group', async () => {
		const b = await budgetWithCard();

		const { groups } = await b.view();
		expect(groups.map((g) => [g.name, g.kind])).toEqual([
			['Credit Card Payments', 'creditCardPayments'],
			['Everyday', 'normal']
		]);
		expect(groups[0]?.categories.map((c) => c.name)).toEqual(['Discover']);
	});

	test("leaves the card's starting debt out of every Category and Ready to Assign", async () => {
		const b = await budgetWithCard();

		const view = await b.view();
		expect(view.readyToAssign).toEqual({ amount: 300_000, uncategorized: 0 });
		expect(view.uncategorizedCount).toBe(0);
		expect(await b.row('Discover')).toMatchObject({
			activity: 0,
			available: 0,
			payment: { waitingOn: [], uncovered: 20_000 }
		});
	});

	test('keeps its Payment Category named after it', async () => {
		const b = await budgetWithCard();

		await b.owner.mutation(api.accounts.rename, { accountId: b.discover, name: 'Travel Card' });

		expect((await b.view()).groups[0]?.categories.map((c) => c.name)).toEqual(['Travel Card']);
	});
});

test('purchases, a refund, a Cover, and a card payment give the Payment Category its money', async () => {
	const b = await budgetWithCard();
	await b.assign(b.groceries, 30_000);
	await b.assign(b.dining, 10_000);

	await b.buy('2026-08-03', -50_000, b.groceries);
	await b.buy('2026-08-05', -4_000, b.dining);
	await b.buy('2026-08-09', 5_000, b.groceries);

	expect(await b.row('Groceries')).toMatchObject({ available: -15_000 });
	expect(await b.row('Discover')).toMatchObject({
		activity: 49_000,
		available: 49_000,
		payment: {
			waitingOn: [{ id: b.groceries, name: 'Groceries', amount: 15_000 }],
			uncovered: 20_000
		}
	});

	expect(
		await b.owner.mutation(api.budget.cover, { month: '2026-08', categoryId: b.groceries })
	).toBe(15_000);
	expect(await b.row('Discover')).toMatchObject({ payment: { waitingOn: [] } });

	await b.owner.mutation(api.transactions.create, {
		accountId: b.checking,
		transferAccountId: b.discover,
		date: '2026-08-25',
		amount: -30_000,
		payee: '',
		memo: ''
	});

	const view = await b.view();
	expect(await b.row('Discover')).toMatchObject({
		activity: 19_000,
		available: 19_000,
		payment: { waitingOn: [], uncovered: 20_000 }
	});
	expect(view.readyToAssign.amount).toBe(245_000);
	expect(await b.row('Groceries')).toMatchObject({ available: 0 });
	const balances = Object.fromEntries(
		(await b.owner.query(api.accounts.list, {})).map((a) => [a.name, a.balance])
	);
	expect(balances).toEqual({ Checking: 270_000, Discover: -39_000 });
});

test('an Uncategorized card purchase moves its amount out of Ready to Assign', async () => {
	const b = await budgetWithCard();

	await b.buy('2026-08-03', -4_000);

	expect((await b.view()).readyToAssign).toEqual({ amount: 296_000, uncategorized: -4_000 });
	expect(await b.row('Discover')).toMatchObject({ available: 4_000 });
});

describe('a Payment Category', () => {
	test('takes Assigned money, to pay down debt the card had before the cutover', async () => {
		const b = await budgetWithCard();
		const discoverPayment = (await b.row('Discover')).id;

		await b.assign(discoverPayment, 20_000);

		expect(await b.row('Discover')).toMatchObject({
			available: 20_000,
			payment: { uncovered: 0 }
		});
		expect((await b.view()).readyToAssign.amount).toBe(280_000);
	});

	test('is managed by Budge, so the owner cannot rename, hide, delete, or target it', async () => {
		const b = await budgetWithCard();
		const discoverPayment = (await b.row('Discover')).id;
		const paymentGroup = (await b.view()).groups[0]?.id;
		if (paymentGroup === undefined) throw new Error('The Credit Card Payments group is missing.');

		const attempts = [
			b.owner.mutation(api.categories.rename, { categoryId: discoverPayment, name: 'Mine' }),
			b.owner.mutation(api.categories.setHidden, { categoryId: discoverPayment, hidden: true }),
			b.owner.mutation(api.categories.remove, {
				categoryId: discoverPayment,
				destinationId: b.groceries
			}),
			b.owner.mutation(api.categories.setTarget, {
				categoryId: discoverPayment,
				target: { kind: 'monthly', amount: 1_000, mode: 'refill' }
			}),
			b.owner.mutation(api.categories.create, { groupId: paymentGroup, name: 'Mine' }),
			b.owner.mutation(api.categories.renameGroup, { groupId: paymentGroup, name: 'Mine' })
		];
		for (const attempt of attempts) expect(await publicErrorCode(attempt)).toBe('INVALID_INPUT');
	});
});

test("refuses a Payment Category on any Transaction but its own card's", async () => {
	const b = await budgetWithCard();
	const discoverPayment = (await b.row('Discover')).id;

	expect(
		await publicErrorCode(
			b.owner.mutation(api.transactions.create, {
				accountId: b.checking,
				date: '2026-08-04',
				amount: -1_000,
				payee: 'Sample Shop',
				categoryId: discoverPayment,
				memo: ''
			})
		)
	).toBe('INVALID_INPUT');
});
