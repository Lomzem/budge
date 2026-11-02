import { Effect, Exit, Layer } from 'effect';
import { describe, expect, test } from 'vitest';

import { decodeSyncPage } from '../src/lib/domain/plaid';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { PlaidApi, PlaidClient, type SyncRequest } from './lib/plaidClient';
import { setupConnection, SyncStore, syncConnection } from './lib/sync';
import { TokenCipher } from './lib/tokenCipher';
import { newBackend, publicErrorMessage, useOwnerEnv } from './test.helper';

useOwnerEnv();

// Invented credentials, IDs, Bank Text, and amounts; nothing here is real bank data.
const accessToken = 'access-token-synthetic-not-real';
const itemId = 'item-synthetic-changes';
const externalId = 'account-synthetic-checking';
const tokenKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

/** One Plaid Transaction as `/transactions/sync` writes it: outflows positive, in dollars. */
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

/** A decoded page of Plaid's changes. Each call's cursor follows the last. */
let pageNumber = 0;
function changes({
	added = [],
	modified = [],
	removed = []
}: {
	added?: object[];
	modified?: object[];
	removed?: string[];
}) {
	pageNumber++;
	return Effect.runSync(
		decodeSyncPage({
			added,
			modified,
			removed: removed.map((id) => ({ transaction_id: id, account_id: externalId })),
			next_cursor: `cursor-synthetic-${String(pageNumber)}`,
			has_more: false
		})
	);
}

type FakePlaid = Parameters<typeof PlaidClient.layerTest>[0];

async function syncedBudget() {
	const backend = newBackend();
	const { owner, t } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	const checking = await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 100_000
	});
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
			return Exit.isSuccess(exit) ? exit.value : null;
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
	if (connectionId === null) throw new Error('setup failed');

	/** Syncs whatever `transactionsSync` answers. */
	const syncWith = (transactionsSync: NonNullable<FakePlaid['transactionsSync']>) =>
		run({ transactionsSync }, syncConnection(connectionId, { refresh: false }));
	const sync = (page: ReturnType<typeof changes>) => syncWith(() => Effect.succeed(page));
	/**
	 * Applies `page` a second time, as a restarted update does: the cursor goes back to where it
	 * was before the page, and the same page comes again.
	 */
	const replay = async (page: ReturnType<typeof changes>, from: string | undefined) => {
		if (from === undefined) throw new Error('Replay needs the cursor before the page.');
		await t.run(async (ctx) => {
			const connection = await ctx.db.get('bankConnections', connectionId);
			if (connection?.provider.kind !== 'plaid') throw new Error('expected Plaid');
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
	const row = async (payeeName: string) => {
		const found = (await rows()).find((r) => r.payeeName === payeeName);
		if (found === undefined) throw new Error(`No ${payeeName} Transaction`);
		return found;
	};
	/** Everything sync and resolving write, to compare before and after a replay. */
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
	/** The monthly totals kept along the way equal a rebuild from the Transactions. */
	const expectTotalsRebuild = async () => {
		const kept = await totals();
		await t.mutation(internal.monthlyTotals.rebuild, {});
		expect(await totals()).toEqual(kept);
	};
	/** The IDs a search of the Transactions finds. */
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

/** Syncs `page`, then applies it again and checks the second time changed nothing. */
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

	test('the removed row is never imported again', async () => {
		const budget = await syncedBudget();
		await budget.sync(changes({ removed: [grocer.transaction_id] }));

		await budget.sync(changes({ added: [grocer] }));

		expect((await budget.rows()).map((row) => row.payeeName)).toEqual(['SAMPLE PAYROLL']);
	});

	test('removing a row Budge never imported does nothing', async () => {
		const budget = await syncedBudget();
		const before = await budget.snapshot();

		await budget.sync(changes({ removed: ['txn-synthetic-pending'] }));

		expect(await budget.snapshot()).toEqual(before);
	});
});

/** The ways an owner makes a Transaction theirs, so the bank no longer changes it quietly. */
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
				// The Bank Row keeps the bank's newest values.
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
		if (importId === undefined) throw new Error('No Bank Row');
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

		expect(
			await publicErrorMessage(
				budget.owner.mutation(api.imports.resolveBankChange, { importId, keep: 'bank' })
			)
		).toMatch(/split/);
		expect(await budget.row('SAMPLE GROCER 0193')).toMatchObject({
			amount: -4_250,
			bankRows: [{ state: 'changed' }]
		});
	});
});

describe('resolving a bank removal', () => {
	async function flaggedRemoval() {
		const budget = await syncedBudget();
		await ownerVersions.edited(budget);
		const page = changes({ removed: [grocer.transaction_id] });
		const before = await budget.cursor();
		await budget.sync(page);
		const importId = (await budget.row('SAMPLE GROCER 0193')).bankRows[0]?._id;
		if (importId === undefined) throw new Error('No Bank Row');
		return { budget, importId, replay: () => budget.replay(page, before) };
	}

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

	test('a Bank Row with nothing to resolve is refused', async () => {
		const budget = await syncedBudget();
		const importId = (await budget.row('SAMPLE PAYROLL')).bankRows[0]?._id as Id<'imports'>;

		expect(
			await publicErrorMessage(
				budget.owner.mutation(api.imports.resolveBankChange, { importId, keep: 'mine' })
			)
		).toBeDefined();
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
				// The first batch: three pages, the first holding the changes.
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
				// The update again from its start: the same changes, then nothing more.
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
});
