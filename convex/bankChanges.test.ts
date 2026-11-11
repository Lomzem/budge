import { Cause, Effect, Exit, Layer } from 'effect';
import { assert, describe, expect, test } from 'vitest';

import { BANK_CHANGE_LIMIT } from '../src/lib/domain/bankChanges';
import { decodeSyncPage } from '../src/lib/domain/plaid';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { PlaidApi, PlaidClient, type SyncRequest } from './lib/plaidClient';
import { setupConnection, SyncStore, syncConnection } from './lib/sync';
import { TokenCipher } from './lib/tokenCipher';
import {
	publicErrorCode,
	publicErrorMessage,
	publicErrorOf,
	startBudget,
	useOwnerEnv
} from './test.helper';

useOwnerEnv();

const accessToken = 'access-token-synthetic-not-real';
const itemId = 'item-synthetic-changes';
const externalId = 'account-synthetic-checking';
const tokenKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

const plaidRow = (transactionId: string, date: string, amount: number, name: string) => ({
	transaction_id: transactionId,
	account_id: externalId,
	amount,
	date,
	name,
	pending: false
});

const grocer = plaidRow('txn-synthetic-grocer', '2026-08-14', 42.5, 'SAMPLE GROCER 0193');
const payroll = plaidRow('txn-synthetic-payroll', '2026-08-15', -2310.42, 'SAMPLE PAYROLL');

let pageNumber = 0;
function changes(
	{
		added = [],
		modified = [],
		removed = []
	}: {
		added?: object[];
		modified?: object[];
		removed?: string[];
	},
	account = externalId
) {
	pageNumber++;
	return Effect.runSync(
		decodeSyncPage({
			added,
			modified,
			removed: removed.map((id) => ({ transaction_id: id, account_id: account })),
			next_cursor: `cursor-synthetic-${String(pageNumber)}`,
			has_more: false
		})
	);
}

type FakePlaid = Parameters<typeof PlaidClient.layerTest>[0];

async function syncedBudget() {
	const backend = await startBudget({ accounts: { Checking: ['cash', 100_000] } });
	const { owner, t } = backend;
	const { Checking: checking } = backend.accounts;
	const run = <A, E>(
		plaid: FakePlaid,
		program: Effect.Effect<A, E, PlaidClient | TokenCipher | SyncStore>
	) =>
		t.action(async (ctx) => {
			const exit = await Effect.runPromiseExit(
				program.pipe(
					Effect.provide(
						Layer.mergeAll(
							PlaidClient.layerTest(plaid),
							TokenCipher.layer(tokenKey),
							SyncStore.layer(ctx)
						)
					)
				)
			);
			if (Exit.isFailure(exit)) assert.fail(`Bank operation failed: ${Cause.pretty(exit.cause)}`);
			return exit.value;
		});
	const connectionId = await run(
		{ setWebhook: () => Effect.void },
		setupConnection({
			name: 'Sample Bank',
			itemId,
			accessToken,
			webhook: 'https://budge.example.test/plaid/webhook',
			accounts: [{ externalId, accountId: checking }]
		})
	);

	const syncWith = async (
		transactionsSync: NonNullable<FakePlaid['transactionsSync']>,
		account = externalId
	) => {
		const outcome = await run(
			{
				transactionsSync,
				itemGet: () => Effect.succeed({ consentExpiresAt: null }),
				accountsGet: () =>
					Effect.succeed([
						{ externalId: account, name: 'Sample Checking', kind: 'cash', balance: null }
					])
			},
			syncConnection(connectionId, { refresh: false })
		);
		assert(outcome.kind === 'synced', `Expected a finished sync, got ${outcome.kind}`);
		return outcome;
	};
	const sync = (page: ReturnType<typeof changes>, account = externalId) =>
		syncWith(() => Effect.succeed(page), account);
	const replay = async (page: ReturnType<typeof changes>, from: string | undefined) => {
		assert(from !== undefined, 'Replay needs the cursor before the page.');
		await t.run(async (ctx) => {
			const connection = await ctx.db.get('bankConnections', connectionId);
			assert(connection?.provider.kind === 'plaid', 'expected Plaid');
			await ctx.db.patch('bankConnections', connectionId, {
				provider: { ...connection.provider, cursor: from }
			});
		});
		await sync(page);
	};
	const cursor = async () => {
		const connection = await t.run((ctx) => ctx.db.get('bankConnections', connectionId));
		return connection?.provider.kind === 'plaid' ? connection.provider.cursor : undefined;
	};
	const rows = async () =>
		(
			await owner.query(api.transactions.list, {
				accountId: checking,
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page.filter((row) => row.payeeName !== 'Starting Balance');
	const row = async (payeeName: string | null) => {
		const found = (await rows()).find((r) => r.payeeName === payeeName);
		assert(found !== undefined, `No ${payeeName ?? 'unnamed'} Transaction`);
		return found;
	};
	const snapshot = () =>
		t.run(async (ctx) => ({
			transactions: await ctx.db.query('transactions').collect(),
			splits: await ctx.db.query('transactionSplits').collect(),
			imports: await ctx.db.query('imports').collect(),
			totals: await ctx.db.query('monthlyTotals').collect()
		}));
	const totals = async () =>
		(await t.run((ctx) => ctx.db.query('monthlyTotals').collect()))
			.map(({ month, accountId, bucket, amount, count }) => ({
				month,
				accountId,
				bucket,
				amount,
				count
			}))
			.sort((a, b) =>
				`${a.month}${a.accountId}${a.bucket}`.localeCompare(`${b.month}${b.accountId}${b.bucket}`)
			);
	const expectTotalsRebuild = async () => {
		const kept = await totals();
		await t.mutation(internal.monthlyTotals.rebuild, {});
		expect(await totals()).toEqual(kept);
	};
	const search = async (words: string) =>
		(
			await owner.query(api.transactions.list, {
				search: words,
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page.map((found) => found._id);
	const balance = async () =>
		(await owner.query(api.accounts.list, {})).find((account) => account._id === checking)?.balance;

	await sync(changes({ added: [grocer, payroll] }));
	return {
		...backend,
		checking,
		connectionId,
		sync,
		syncWith,
		replay,
		cursor,
		rows,
		row,
		snapshot,
		expectTotalsRebuild,
		search,
		balance
	};
}

type Budget = Awaited<ReturnType<typeof syncedBudget>>;

async function backWithStatementRow(
	budget: Budget,
	transactionId: Id<'transactions'>,
	{ accountId, date, amount }: { accountId: Id<'accounts'>; date: string; amount: number }
) {
	return await budget.t.run((ctx) =>
		ctx.db.insert('imports', {
			source: 'csv',
			accountId,
			date,
			amount,
			bankText: 'SAMPLE STATEMENT ROW',
			transactionId,
			matched: true,
			state: 'linked'
		})
	);
}

async function grocerUnderReissuedAccountId(
	budget: Budget,
	reissue: number,
	bankText = grocer.name
) {
	const account = `account-synthetic-reissued-${String(reissue)}`;
	const transactionId = `txn-synthetic-grocer-reissued-${String(reissue)}`;
	const row = { ...grocer, name: bankText, transaction_id: transactionId, account_id: account };
	expect(await budget.sync(changes({ added: [row] }, account), account)).toMatchObject({
		held: 1
	});
	const [held] = await budget.owner.query(api.heldAccounts.list, {});
	assert(held !== undefined, 'No held Account');
	await budget.owner.mutation(api.heldAccounts.map, {
		connectionAccountId: held._id,
		accountId: budget.checking
	});
	return { account, transactionId, row };
}

async function grocerAsTransfer(budget: Budget) {
	const savings = await budget.owner.mutation(api.accounts.create, {
		name: 'Savings',
		kind: 'cash',
		startingBalance: 0
	});
	const grocerRow = await budget.row('SAMPLE GROCER 0193');
	await budget.owner.mutation(api.transactions.update, {
		transactionId: grocerRow._id,
		accountId: grocerRow.accountId,
		transferAccountId: savings,
		date: grocerRow.date,
		amount: grocerRow.amount,
		payee: '',
		memo: 'to savings'
	});
	const savingsSide = (
		await budget.owner.query(api.transactions.list, {
			accountId: savings,
			paginationOpts: { numItems: 50, cursor: null }
		})
	).page.find((row) => row.amount === 4_250);
	assert(savingsSide !== undefined, 'No Savings side');
	return { savings, savingsSide };
}

async function expectRefused(
	budget: Budget,
	resolve: { importId: Id<'imports'>; keep: 'bank' | 'mine' },
	reason?: RegExp
) {
	const everyRow = async () =>
		(
			await budget.owner.query(api.transactions.list, {
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page;
	const before = await everyRow();

	const refusal = await publicErrorOf(
		budget.owner.mutation(api.imports.resolveBankChange, resolve)
	);

	expect(refusal?.code).toBe('INVALID_INPUT');
	if (reason !== undefined) expect(refusal?.message).toMatch(reason);
	expect(await everyRow()).toEqual(before);
}

async function reconcileChecking(budget: Budget) {
	await budget.owner.mutation(api.reconciliation.reconcile, {
		accountId: budget.checking,
		balance: 100_000 + 231_042 - 4_250,
		date: '2026-08-31'
	});
}

async function syncTwice(budget: Budget, page: ReturnType<typeof changes>) {
	const before = await budget.cursor();
	await budget.sync(page);
	const once = await budget.snapshot();
	await budget.replay(page, before);
	expect(await budget.snapshot()).toEqual(once);
}

const grocerChanged = { ...grocer, date: '2026-08-16', amount: 45.5 };

describe('a bank change to an Unapproved, unedited Transaction', () => {
	test('is applied quietly, and applying it again changes nothing', async () => {
		const budget = await syncedBudget();

		await syncTwice(budget, changes({ modified: [grocerChanged] }));

		expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject({
			date: '2026-08-16',
			amount: -4_550,
			approved: false,
			bankRows: [{ state: 'linked', date: '2026-08-16', amount: -4_550, matched: false }]
		});
		expect(await budget.balance()).toBe(100_000 + 231_042 - 4_550);
		await budget.expectTotalsRebuild();
	});

	test('a new Bank Text names the Payee again', async () => {
		const budget = await syncedBudget();

		await budget.sync(changes({ modified: [{ ...grocer, name: 'SAMPLE GROCERY MARKET 0193' }] }));

		expect(await budget.row('SAMPLE GROCERY MARKET 0193')).toMatchObject({
			amount: -4_250,
			bankRows: [{ bankText: 'SAMPLE GROCERY MARKET 0193', state: 'linked' }]
		});
	});
});

describe('a bank removal of an Unapproved, unedited Transaction', () => {
	test('deletes it quietly, and removing it again changes nothing', async () => {
		const budget = await syncedBudget();

		await syncTwice(budget, changes({ removed: [grocer.transaction_id] }));

		expect((await budget.rows()).map((row) => row.payeeName)).toEqual(['SAMPLE PAYROLL']);
		expect(await budget.balance()).toBe(100_000 + 231_042);
		await budget.expectTotalsRebuild();
	});

	test('a change that moves it before the Cutover Date removes it the same way', async () => {
		const budget = await syncedBudget();

		await syncTwice(budget, changes({ modified: [{ ...grocer, date: '2026-07-30' }] }));

		expect((await budget.rows()).map((row) => row.payeeName)).toEqual(['SAMPLE PAYROLL']);
		expect(
			(await budget.snapshot()).imports
				.filter((bankRow) => bankRow.sourceId === grocer.transaction_id)
				.map((bankRow) => bankRow.state)
		).toEqual(['removed']);
		expect(await budget.balance()).toBe(100_000 + 231_042);
		await budget.expectTotalsRebuild();
	});

	test('the removed row is never imported again', async () => {
		const budget = await syncedBudget();
		await budget.sync(changes({ removed: [grocer.transaction_id] }));

		await budget.sync(changes({ added: [grocer] }));

		expect((await budget.rows()).map((row) => row.payeeName)).toEqual(['SAMPLE PAYROLL']);
	});

	test('removing a row Budge never imported does nothing', async () => {
		const budget = await syncedBudget();
		const before = await budget.snapshot();

		const outcome = await budget.sync(changes({ removed: ['txn-synthetic-pending'] }));

		expect(outcome).toMatchObject({ kind: 'synced' });
		expect(await budget.snapshot()).toEqual(before);
	});
});

const ownerVersions = {
	approved: async (budget: Budget) => {
		const grocerRow = await budget.row('SAMPLE GROCER 0193');
		await budget.owner.mutation(api.transactions.approve, { transactionId: grocerRow._id });
	},
	edited: async (budget: Budget) => {
		const grocerRow = await budget.row('SAMPLE GROCER 0193');
		await budget.owner.mutation(api.transactions.update, {
			transactionId: grocerRow._id,
			accountId: grocerRow.accountId,
			date: grocerRow.date,
			amount: grocerRow.amount,
			payee: 'SAMPLE GROCER 0193',
			memo: 'weekly shop'
		});
	}
};

describe('a bank change to a Transaction the owner approved or edited', () => {
	test.each(Object.entries(ownerVersions))(
		'(%s) keeps the owner’s version and flags it, once',
		async (_, makeOwn) => {
			const budget = await syncedBudget();
			await makeOwn(budget);

			await syncTwice(budget, changes({ modified: [grocerChanged] }));

			expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject({
				date: '2026-08-14',
				amount: -4_250,
				approved: true,
				bankRows: [{ state: 'changed', date: '2026-08-16', amount: -4_550 }]
			});
			await budget.expectTotalsRebuild();
		}
	);

	test('a Matched Transaction keeps what the owner entered and is flagged', async () => {
		const budget = await syncedBudget();
		await budget.owner.mutation(api.transactions.create, {
			accountId: budget.checking,
			date: '2026-08-20',
			amount: -1_200,
			payee: 'Hardware Store',
			memo: ''
		});
		await budget.sync(
			changes({ added: [plaidRow('txn-synthetic-hardware', '2026-08-21', 12, 'SAMPLE HW 77')] })
		);

		await syncTwice(
			budget,
			changes({ modified: [plaidRow('txn-synthetic-hardware', '2026-08-21', 13, 'SAMPLE HW 77')] })
		);

		expect(await budget.row('Hardware Store')).toMatchObject({
			amount: -1_200,
			approved: false,
			bankRows: [{ state: 'changed', amount: -1_300, matched: true }]
		});
	});

	test('a change to the Bank Text alone updates the Bank Row without a flag', async () => {
		const budget = await syncedBudget();
		await ownerVersions.approved(budget);

		await budget.sync(changes({ modified: [{ ...grocer, name: 'SAMPLE GROCERY 0193' }] }));

		const grocerRow = await budget.row('SAMPLE GROCER 0193');
		expect(grocerRow).toMatchObject({
			bankRows: [{ bankText: 'SAMPLE GROCERY 0193', state: 'linked' }]
		});
		expect(await budget.search('grocery')).toEqual([grocerRow._id]);
	});
});

describe('a bank removal of a Transaction the owner approved or edited', () => {
	test.each(Object.entries(ownerVersions))(
		'(%s) keeps it and flags it, once',
		async (_, makeOwn) => {
			const budget = await syncedBudget();
			await makeOwn(budget);

			await syncTwice(budget, changes({ removed: [grocer.transaction_id] }));

			expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject({
				amount: -4_250,
				bankRows: [{ state: 'removed' }]
			});
			expect(await budget.balance()).toBe(100_000 + 231_042 - 4_250);
			await budget.expectTotalsRebuild();
		}
	);
});

describe('resolving a bank change', () => {
	async function flaggedChange() {
		const budget = await syncedBudget();
		await ownerVersions.edited(budget);
		const page = changes({ modified: [grocerChanged] });
		const before = await budget.cursor();
		await budget.sync(page);
		const flagged = await budget.row('SAMPLE GROCER 0193');
		const importId = flagged.bankRows[0]?._id;
		assert(importId !== undefined, 'No Bank Row');
		return { budget, importId, replay: () => budget.replay(page, before) };
	}

	test("the bank's version takes its date and amount, keeping the rest, and clears the flag", async () => {
		const { budget, importId, replay } = await flaggedChange();

		await budget.owner.mutation(api.imports.resolveBankChange, { importId, keep: 'bank' });

		const expected = {
			date: '2026-08-16',
			amount: -4_550,
			memo: 'weekly shop',
			approved: true,
			bankRows: [{ state: 'linked', amount: -4_550 }]
		};
		expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject(expected);
		await budget.expectTotalsRebuild();
		await replay();
		expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject(expected);
	});

	test("the owner's version stays, the flag clears, and a replay doesn't raise it again", async () => {
		const { budget, importId, replay } = await flaggedChange();

		await budget.owner.mutation(api.imports.resolveBankChange, { importId, keep: 'mine' });

		const expected = {
			date: '2026-08-14',
			amount: -4_250,
			memo: 'weekly shop',
			bankRows: [{ state: 'linked', amount: -4_550 }]
		};
		expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject(expected);
		await replay();
		expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject(expected);
		await budget.expectTotalsRebuild();
	});

	test("the bank's amount on a split is refused until the split is edited", async () => {
		const budget = await syncedBudget();
		const grocerRow = await budget.row('SAMPLE GROCER 0193');
		const groupId = await budget.owner.mutation(api.categories.createGroup, { name: 'Everyday' });
		const category = (name: string) =>
			budget.owner.mutation(api.categories.create, { groupId, name });
		const groceries = await category('Groceries');
		const household = await category('Household');
		await budget.owner.mutation(api.transactions.update, {
			transactionId: grocerRow._id,
			accountId: grocerRow.accountId,
			date: grocerRow.date,
			amount: grocerRow.amount,
			payee: 'SAMPLE GROCER 0193',
			memo: '',
			splits: [
				{ categoryId: groceries, amount: -2_000, memo: '' },
				{ categoryId: household, amount: -2_250, memo: '' }
			]
		});
		await budget.sync(changes({ modified: [grocerChanged] }));
		const importId = (await budget.row('SAMPLE GROCER 0193')).bankRows[0]?._id as Id<'imports'>;

		await expectRefused(budget, { importId, keep: 'bank' }, /split/);
		expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject({
			amount: -4_250,
			splits: [{ amount: -2_000 }, { amount: -2_250 }],
			bankRows: [{ state: 'changed' }]
		});
	});
	test.each([
		['flags', 'no longer agrees', { date: '2026-08-14', amount: 4_250 }, 'changed'],
		['leaves linked', 'agrees', { date: '2026-08-16', amount: 4_550 }, 'linked']
	] as const)(
		"the bank's version on a Transfer %s the other side's statement row that %s",
		async (_does, _agreement, statementRow, state) => {
			const budget = await syncedBudget();
			const { savings, savingsSide } = await grocerAsTransfer(budget);
			await backWithStatementRow(budget, savingsSide._id, { accountId: savings, ...statementRow });
			await budget.sync(changes({ modified: [grocerChanged] }));
			const importId = (await budget.row(null)).bankRows[0]?._id;
			assert(importId !== undefined, 'No Bank Row');

			await budget.owner.mutation(api.imports.resolveBankChange, { importId, keep: 'bank' });

			const otherSide = (
				await budget.owner.query(api.transactions.list, {
					accountId: savings,
					paginationOpts: { numItems: 50, cursor: null }
				})
			).page.find((row) => row._id === savingsSide._id);
			expect(otherSide).toMatchObject({
				amount: 4_550,
				bankRows: [{ state, amount: statementRow.amount }]
			});
		}
	);

	test("the bank's version on a Transfer flags the other side's eleventh statement row that no longer agrees, behind ten that do", async () => {
		const budget = await syncedBudget();
		const { savings, savingsSide } = await grocerAsTransfer(budget);
		for (let index = 0; index < 10; index++) {
			await backWithStatementRow(budget, savingsSide._id, {
				accountId: savings,
				date: '2026-08-16',
				amount: 4_550
			});
		}
		const eleventh = await backWithStatementRow(budget, savingsSide._id, {
			accountId: savings,
			date: '2026-08-14',
			amount: 4_250
		});
		await budget.sync(changes({ modified: [grocerChanged] }));
		const importId = (await budget.row(null)).bankRows[0]?._id;
		assert(importId !== undefined, 'No Bank Row');

		await budget.owner.mutation(api.imports.resolveBankChange, { importId, keep: 'bank' });

		expect(
			await publicErrorCode(
				budget.owner.mutation(api.imports.resolveBankChange, { importId: eleventh, keep: 'mine' })
			)
		).toBeUndefined();
	});

	test("the bank's version is refused on a reconciled Transaction", async () => {
		const { budget, importId } = await flaggedChange();
		await reconcileChecking(budget);

		await expectRefused(budget, { importId, keep: 'bank' }, /reconciled/i);
		expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject({
			amount: -4_250,
			reconciled: true,
			bankRows: [{ state: 'changed' }]
		});
	});
});

async function flaggedRemoval() {
	const budget = await syncedBudget();
	await ownerVersions.edited(budget);
	const page = changes({ removed: [grocer.transaction_id] });
	const before = await budget.cursor();
	await budget.sync(page);
	const importId = (await budget.row('SAMPLE GROCER 0193')).bankRows[0]?._id;
	assert(importId !== undefined, 'No Bank Row');
	return { budget, importId, replay: () => budget.replay(page, before) };
}

describe('resolving a bank removal', () => {
	test("the bank's version deletes the Transaction", async () => {
		const { budget, importId, replay } = await flaggedRemoval();

		await budget.owner.mutation(api.imports.resolveBankChange, { importId, keep: 'bank' });

		expect((await budget.rows()).map((row) => row.payeeName)).toEqual(['SAMPLE PAYROLL']);
		expect(await budget.balance()).toBe(100_000 + 231_042);
		await budget.expectTotalsRebuild();
		const resolved = await budget.snapshot();
		await replay();
		expect(await budget.snapshot()).toEqual(resolved);
	});

	test("the owner's version keeps the Transaction without the bank's row", async () => {
		const { budget, importId, replay } = await flaggedRemoval();

		await budget.owner.mutation(api.imports.resolveBankChange, { importId, keep: 'mine' });

		expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject({
			amount: -4_250,
			memo: 'weekly shop',
			cleared: true,
			bankRows: []
		});
		const resolved = await budget.snapshot();
		await replay();
		expect(await budget.snapshot()).toEqual(resolved);
		await budget.expectTotalsRebuild();
	});

	test("the owner's version is no longer found by the removed row's Bank Text", async () => {
		const { budget, importId } = await flaggedRemoval();
		const grocerRow = await budget.row('SAMPLE GROCER 0193');
		await budget.owner.mutation(api.transactions.update, {
			transactionId: grocerRow._id,
			accountId: grocerRow.accountId,
			date: grocerRow.date,
			amount: grocerRow.amount,
			payee: 'Corner Market',
			memo: 'weekly shop'
		});
		expect(await budget.search('grocer')).toEqual([grocerRow._id]);

		await budget.owner.mutation(api.imports.resolveBankChange, { importId, keep: 'mine' });

		expect(await budget.search('grocer')).toEqual([]);
		expect(await budget.search('corner')).toEqual([grocerRow._id]);
	});

	test("the bank's version is refused while another statement row still backs the Transaction", async () => {
		const { budget, importId } = await flaggedRemoval();
		const grocerRow = await budget.row('SAMPLE GROCER 0193');
		await backWithStatementRow(budget, grocerRow._id, {
			accountId: budget.checking,
			date: grocerRow.date,
			amount: grocerRow.amount
		});

		await expectRefused(budget, { importId, keep: 'bank' }, /still/);
		expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject({
			amount: -4_250,
			bankRows: [{ state: 'removed' }, { state: 'linked', bankText: 'SAMPLE STATEMENT ROW' }]
		});
	});

	test("the bank's version is refused while a bank row behind many removed ones still backs the Transaction", async () => {
		const { budget, importId } = await flaggedRemoval();
		for (let reissue = 1; reissue <= 10; reissue++) {
			const { account, transactionId } = await grocerUnderReissuedAccountId(budget, reissue);
			await budget.sync(changes({ removed: [transactionId] }, account), account);
		}
		await grocerUnderReissuedAccountId(budget, 11);
		expect(await budget.rows()).toHaveLength(2);

		await expectRefused(budget, { importId, keep: 'bank' }, /still/);
	});

	test("the bank's version on a Transfer is refused while the other side has its own statement row", async () => {
		const budget = await syncedBudget();
		const { savings, savingsSide } = await grocerAsTransfer(budget);
		await backWithStatementRow(budget, savingsSide._id, {
			accountId: savings,
			date: '2026-08-14',
			amount: 4_250
		});
		await budget.sync(changes({ removed: [grocer.transaction_id] }));
		const importId = (await budget.row(null)).bankRows[0]?._id;
		assert(importId !== undefined, 'No Bank Row');

		await expectRefused(budget, { importId, keep: 'bank' }, /still/);
		expect(await budget.row(null)).toMatchObject({
			amount: -4_250,
			transfer: { accountId: savings },
			bankRows: [{ state: 'removed' }]
		});
	});

	test("the bank's version is refused on a reconciled Transaction", async () => {
		const { budget, importId } = await flaggedRemoval();
		await reconcileChecking(budget);

		await expectRefused(budget, { importId, keep: 'bank' }, /reconciled/i);
		expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject({
			amount: -4_250,
			reconciled: true,
			bankRows: [{ state: 'removed' }]
		});
	});

	test('a Bank Row with nothing to resolve is refused', async () => {
		const budget = await syncedBudget();
		const importId = (await budget.row('SAMPLE PAYROLL')).bankRows[0]?._id as Id<'imports'>;

		await expectRefused(budget, { importId, keep: 'mine' });
		expect(await budget.row('SAMPLE PAYROLL')).toMatchObject({
			approved: false,
			bankRows: [{ state: 'linked' }]
		});
	});
});

test('a restarted update applies its changes again without changing anything twice', async () => {
	const budget = await syncedBudget();
	await ownerVersions.approved(budget);
	const first = changes({
		modified: [grocerChanged],
		removed: [payroll.transaction_id]
	});
	const cursors: (string | null)[] = [];
	const transactionsSync = (request: SyncRequest) => {
		cursors.push(request.cursor);
		switch (cursors.length) {
			case 1:
			case 2:
			case 3:
				return Effect.succeed({
					...(cursors.length === 1 ? first : changes({})),
					nextCursor: `cursor-synthetic-restart-${String(cursors.length)}`,
					hasMore: true
				});
			case 4:
				return Effect.fail(
					new PlaidApi({
						error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION',
						status: 400,
						request_id: 'request-synthetic-restart'
					})
				);
			default:
				return Effect.succeed(cursors.length === 5 ? first : changes({}));
		}
	};

	await budget.syncWith(transactionsSync);

	expect(cursors[4]).toBe(cursors[0]);
	expect(await budget.rows()).toMatchObject([
		{
			payeeName: 'SAMPLE GROCER 0193',
			amount: -4_250,
			bankRows: [{ state: 'changed', amount: -4_550 }]
		}
	]);
	await budget.expectTotalsRebuild();
});

describe('Unmatching a flagged Bank Row', () => {
	async function matchedHardware() {
		const budget = await syncedBudget();
		await budget.owner.mutation(api.transactions.create, {
			accountId: budget.checking,
			date: '2026-08-20',
			amount: -1_200,
			payee: 'Hardware Store',
			memo: ''
		});
		await budget.sync(
			changes({ added: [plaidRow('txn-synthetic-hardware', '2026-08-21', 12, 'SAMPLE HW 77')] })
		);
		const importId = async () =>
			(await budget.row('Hardware Store')).bankRows[0]?._id as Id<'imports'>;
		return { budget, importId };
	}

	test("a changed one becomes its own Transaction with the bank's values, unflagged", async () => {
		const { budget, importId } = await matchedHardware();
		await budget.sync(
			changes({ modified: [plaidRow('txn-synthetic-hardware', '2026-08-21', 13, 'SAMPLE HW 77')] })
		);

		await budget.owner.mutation(api.imports.unmatch, { importId: await importId() });

		expect(await budget.row('SAMPLE HW 77')).toMatchObject({
			amount: -1_300,
			bankRows: [{ state: 'linked', matched: false }]
		});
		expect(await budget.row('Hardware Store')).toMatchObject({ amount: -1_200, bankRows: [] });
	});

	test('a removed one is refused, so the bank’s removal is resolved instead', async () => {
		const { budget, importId } = await matchedHardware();
		await budget.sync(changes({ removed: ['txn-synthetic-hardware'] }));

		expect(
			await publicErrorMessage(
				budget.owner.mutation(api.imports.unmatch, { importId: await importId() })
			)
		).toMatch(/removed/);
	});

	test('the Transaction it leaves is no longer Cleared when the bank removed its only other row', async () => {
		const { budget, importId } = await flaggedRemoval();
		const grocerRow = await budget.row('SAMPLE GROCER 0193');
		const statementRowId = await backWithStatementRow(budget, grocerRow._id, {
			accountId: budget.checking,
			date: grocerRow.date,
			amount: grocerRow.amount
		});

		await budget.owner.mutation(api.imports.unmatch, { importId: statementRowId });

		expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject({
			cleared: false,
			bankRows: [{ _id: importId, state: 'removed' }]
		});
	});
});

describe('a Transaction backed by more than ten Bank Rows', () => {
	test('shows its changed Bank Row first among ten, and says when linked ones are left out', async () => {
		const budget = await syncedBudget();
		await ownerVersions.approved(budget);
		let last;
		for (let reissue = 1; reissue <= 11; reissue++) {
			last = await grocerUnderReissuedAccountId(budget, reissue);
		}
		assert(last !== undefined, 'No reissued Account');
		await budget.sync(
			changes({ modified: [{ ...last.row, amount: 45.5 }] }, last.account),
			last.account
		);

		const grocerRow = await budget.row('SAMPLE GROCER 0193');
		expect(grocerRow.bankRows[0]).toMatchObject({ state: 'changed', amount: -4_550 });
		expect(grocerRow.bankRows.slice(1).map((row) => row.state)).toEqual(
			Array<string>(9).fill('linked')
		);
		expect(grocerRow.moreBankRows).toBe(true);
	});

	test('says nothing is left out when every Bank Row is shown', async () => {
		const budget = await syncedBudget();
		await ownerVersions.approved(budget);
		for (let reissue = 1; reissue <= 9; reissue++) {
			await grocerUnderReissuedAccountId(budget, reissue);
		}

		const grocerRow = await budget.row('SAMPLE GROCER 0193');
		expect(grocerRow.bankRows).toHaveLength(10);
		expect(grocerRow.moreBankRows).toBe(false);
	});

	test('shows ten flagged Bank Rows when more are flagged, and the rest once those are resolved', async () => {
		const { budget } = await flaggedRemoval();
		for (let reissue = 1; reissue <= 10; reissue++) {
			const { account, transactionId } = await grocerUnderReissuedAccountId(budget, reissue);
			await budget.sync(changes({ removed: [transactionId] }, account), account);
		}
		await grocerUnderReissuedAccountId(budget, 11);

		const crowded = await budget.row('SAMPLE GROCER 0193');
		expect(crowded.bankRows.map((row) => row.state)).toEqual(Array<string>(10).fill('removed'));
		expect(crowded.moreBankRows).toBe(true);

		for (const { _id } of crowded.bankRows) {
			await budget.owner.mutation(api.imports.resolveBankChange, { importId: _id, keep: 'mine' });
		}
		const resolved = await budget.row('SAMPLE GROCER 0193');
		expect(resolved.bankRows.map((row) => row.state)).toEqual(['removed', 'linked']);
		expect(resolved.moreBankRows).toBe(false);
	});

	test("search finds the eleventh Bank Row's Bank Text", async () => {
		const budget = await syncedBudget();
		for (let reissue = 1; reissue <= 10; reissue++) {
			await grocerUnderReissuedAccountId(
				budget,
				reissue,
				reissue === 10 ? 'SAMPLE CORNER MARKET 44' : grocer.name
			);
		}
		const grocerRow = await budget.row('SAMPLE GROCER 0193');

		expect(await budget.search('corner market')).toEqual([grocerRow._id]);
	});
});

describe('the Bank changes list', () => {
	test('holds each flagged Transaction, newest first, until the owner resolves it', async () => {
		const budget = await syncedBudget();
		await ownerVersions.edited(budget);
		const payrollRow = await budget.row('SAMPLE PAYROLL');
		await budget.owner.mutation(api.transactions.approve, { transactionId: payrollRow._id });
		await budget.sync(changes({ modified: [grocerChanged], removed: [payroll.transaction_id] }));
		const listed = async (narrowing: { search?: string } = {}) =>
			(
				await budget.owner.query(api.transactions.list, {
					bankChanges: true,
					...narrowing,
					paginationOpts: { numItems: 50, cursor: null }
				})
			).page.map((row) => row.payeeName);
		const count = () =>
			budget.owner.query(api.transactions.bankChangeCount, { accountId: budget.checking });

		expect(await listed()).toEqual(['SAMPLE PAYROLL', 'SAMPLE GROCER 0193']);
		expect(await listed({ search: 'grocer' })).toEqual(['SAMPLE GROCER 0193']);
		expect(await count()).toEqual({ count: 2, complete: true });
		const pageAfter = (cursor: string | null) =>
			budget.owner.query(api.transactions.list, {
				bankChanges: true,
				paginationOpts: { numItems: 1, cursor }
			});
		const first = await pageAfter(null);
		const second = await pageAfter(first.continueCursor);
		expect(
			[first, second].map(({ page, isDone }) => ({
				payees: page.map((row) => row.payeeName),
				isDone
			}))
		).toEqual([
			{ payees: ['SAMPLE PAYROLL'], isDone: false },
			{ payees: ['SAMPLE GROCER 0193'], isDone: true }
		]);

		const importId = (await budget.row('SAMPLE GROCER 0193')).bankRows[0]?._id;
		assert(importId !== undefined, 'No Bank Row');
		await budget.owner.mutation(api.imports.resolveBankChange, { importId, keep: 'mine' });

		expect(await listed()).toEqual(['SAMPLE PAYROLL']);
		expect(await count()).toEqual({ count: 1, complete: true });
	});

	test('past its newest bank changes the whole list says it is incomplete, and an Account with fewer lists all of its own', async () => {
		const { owner, t, accounts } = await startBudget({
			accounts: { Checking: ['cash', 0], Savings: ['cash', 0] }
		});
		await t.run(async (ctx) => {
			const flag = async (accountId: Id<'accounts'>, bankText: string) => {
				const transactionId = await ctx.db.insert('transactions', {
					accountId,
					date: '2026-08-12',
					amount: -100,
					cleared: 'cleared',
					approved: true
				});
				await ctx.db.insert('imports', {
					source: 'plaid',
					accountId,
					date: '2026-08-12',
					amount: -150,
					bankText,
					transactionId,
					matched: true,
					state: 'changed'
				});
			};
			await flag(accounts.Checking, 'SAMPLE CAFE');
			for (let n = 0; n <= BANK_CHANGE_LIMIT; n++) {
				await flag(accounts.Savings, `SAMPLE SHOP ${String(n)}`);
			}
		});
		const count = (accountId?: Id<'accounts'>) =>
			owner.query(api.transactions.bankChangeCount, accountId === undefined ? {} : { accountId });
		const listed = async (accountId: Id<'accounts'>) =>
			(
				await owner.query(api.transactions.list, {
					accountId,
					bankChanges: true,
					paginationOpts: { numItems: 50, cursor: null }
				})
			).page;

		expect(await count()).toEqual({ count: BANK_CHANGE_LIMIT, complete: false });
		expect(await count(accounts.Checking)).toEqual({ count: 1, complete: true });
		expect(await listed(accounts.Checking)).toHaveLength(1);
	});
});
