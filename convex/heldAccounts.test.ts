import { Effect, Exit, Layer } from 'effect';
import { afterEach, assert, beforeEach, describe, expect, test, vi } from 'vitest';

import { decodeSyncPage, type BankAccount, type SyncPage } from '../src/lib/domain/plaid';
import syncPage from '../src/lib/domain/fixtures/synthetic/plaid-sync-page.json';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { PlaidApi, PlaidClient } from './lib/plaidClient';
import { findConnectionAccount } from './bankConnections';
import { HELD_BATCH } from './heldAccounts';
import {
	removeItem,
	setupConnection,
	suggestStartingBalance,
	SyncStore,
	syncConnection
} from './lib/sync';
import { TokenCipher } from './lib/tokenCipher';
import { publicErrorCode, publicErrorOf, startBudget, useOwnerEnv } from './test.helper';

useOwnerEnv();

const cutoverDate = '2026-08-01';
const accessToken = 'access-token-synthetic-not-real';
const checkingId = 'account-synthetic-checking';
const savingsId = 'account-synthetic-savings';
const movedCheckingId = 'account-synthetic-checking-new';
const tokenKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

const page = Effect.runSync(decodeSyncPage(syncPage));
const [payroll] = page.added;
assert(payroll !== undefined, 'the fixture has posted rows');

function rowsFor(externalId: string, idPrefix = externalId): SyncPage {
	return {
		...page,
		added: page.added.map((row) => ({
			...row,
			account_id: externalId,
			transaction_id: `${idPrefix}-${row.transaction_id}`
		}))
	};
}

const bankAccounts: BankAccount[] = [
	{ externalId: checkingId, name: 'Sample Checking', mask: '0042', kind: 'cash', balance: 120_000 },
	{ externalId: savingsId, name: 'Sample Savings', mask: '4321', kind: 'cash', balance: 300_000 }
];

function gate() {
	let open!: () => void;
	const opened = new Promise<void>((resolve) => {
		open = resolve;
	});
	return {
		open: () => {
			open();
		},
		opened
	};
}

type FakePlaid = Parameters<typeof PlaidClient.layerTest>[0];

let answerPlaid: (url: URL, init?: RequestInit) => Promise<Response> = (url) =>
	assert.fail(`Unexpected Plaid call ${url.pathname}`);

function plaidFetch(input: RequestInfo | URL, init?: RequestInit) {
	return answerPlaid(new URL(input instanceof Request ? input.url : input), init);
}

function stubPlaid(answer: typeof answerPlaid) {
	answerPlaid = answer;
	vi.stubGlobal('fetch', plaidFetch);
}

const listedAccounts = (from: number, count: number) =>
	Array.from({ length: count }, (_, n) => ({
		externalId: `account-synthetic-listed-${String(from + n)}`,
		name: `Sample Savings ${String(from + n)}`,
		kind: 'cash' as const
	}));

async function connectedBudget() {
	const backend = await startBudget({ cutoverDate, accounts: { Checking: ['cash', 100_000] } });
	const { owner, t } = backend;
	const { Checking: checking } = backend.accounts;
	const inAction = <A, E>(
		plaid: FakePlaid,
		program: Effect.Effect<A, E, PlaidClient | TokenCipher | SyncStore>
	) =>
		t.action(async (ctx) => {
			const exit = await Effect.runPromiseExit(
				program.pipe(
					Effect.provide(
						Layer.mergeAll(
							PlaidClient.layerTest({
								itemGet: () => Effect.succeed({ consentExpiresAt: null }),
								...plaid
							}),
							TokenCipher.layer(tokenKey),
							SyncStore.layer(ctx)
						)
					)
				)
			);
			assert(Exit.isSuccess(exit), 'the program failed');
			return exit.value;
		});
	const { connectionId } = await inAction(
		{ setWebhook: () => Effect.void },
		setupConnection({
			name: 'Sample Bank',
			itemId: 'item-synthetic-1',
			accessToken,
			webhook: 'https://budge.example.test/plaid/webhook',
			accounts: [{ externalId: checkingId, accountId: checking }]
		})
	);
	const sync = (...answers: (SyncPage | PlaidApi)[]) => {
		let call = 0;
		return inAction(
			{
				transactionsSync: () => {
					const answer = answers[Math.min(call++, answers.length - 1)] ?? page;
					return answer instanceof PlaidApi ? Effect.fail(answer) : Effect.succeed(answer);
				},
				accountsGet: () => Effect.succeed(bankAccounts)
			},
			syncConnection(connectionId, { refresh: false })
		);
	};
	const syncWith = (plaid: FakePlaid) =>
		inAction(plaid, syncConnection(connectionId, { refresh: false }));
	const connectNewBank = async () => {
		const { connectionId: newConnection } = await inAction(
			{ setWebhook: () => Effect.void },
			setupConnection({
				name: 'Sample New Bank',
				itemId: 'item-synthetic-2',
				accessToken,
				webhook: 'https://budge.example.test/plaid/webhook',
				accounts: [{ externalId: movedCheckingId, accountId: checking }]
			})
		);
		return (plaid: FakePlaid) => inAction(plaid, syncConnection(newConnection, { refresh: false }));
	};
	const suggest = (accountId: Id<'accounts'>, reported = bankAccounts) =>
		inAction(
			{
				accountsGet: (token, ids) => {
					expect(token).toBe(accessToken);
					return Effect.succeed(reported.filter((a) => ids?.includes(a.externalId)));
				}
			},
			suggestStartingBalance(accountId)
		);
	const held = () => owner.query(api.heldAccounts.list, {});
	const heldId = async () => {
		const waiting = (await held()).find((account) => account.rows > 0);
		assert(waiting !== undefined, 'expected a held bank Account with rows');
		return waiting._id;
	};
	const transactions = async (accountId?: Id<'accounts'>) =>
		(
			await owner.query(api.transactions.list, {
				...(accountId === undefined ? {} : { accountId }),
				paginationOpts: { numItems: 400, cursor: null }
			})
		).page.filter((row) => row.payeeName !== 'Starting Balance');
	const balanceOf = async (accountId: Id<'accounts'>) =>
		(await owner.query(api.accounts.list, {})).find((a) => a._id === accountId)?.balance;
	return {
		...backend,
		checking,
		connectionId,
		sync,
		syncWith,
		connectNewBank,
		suggest,
		held,
		heldId,
		transactions,
		balanceOf
	};
}

describe('a bank Account Budge does not know', () => {
	test('is held with its rows, named from Plaid, and imports nothing', async () => {
		const { connectionId, sync, held, transactions } = await connectedBudget();

		expect(await sync(rowsFor(savingsId))).toMatchObject({ kind: 'synced', added: 0, held: 2 });

		expect(await held()).toEqual([
			expect.objectContaining({
				connectionId,
				connectionName: 'Sample Bank',
				name: 'Sample Savings',
				mask: '4321',
				rows: 2
			})
		]);
		expect(await transactions()).toEqual([]);
	});

	test('is named on the next sync after the bank could not say its name, even with no new rows', async () => {
		const { syncWith, held } = await connectedBudget();
		const bankDown = new PlaidApi({
			error_code: 'INSTITUTION_NOT_RESPONDING',
			status: 400,
			request_id: 'request-synthetic-names'
		});
		await syncWith({
			transactionsSync: () => Effect.succeed(rowsFor(savingsId)),
			accountsGet: () => Effect.fail(bankDown)
		});
		expect(await held()).toEqual([expect.objectContaining({ name: null, rows: 2 })]);

		await syncWith({
			transactionsSync: () =>
				Effect.succeed({
					...page,
					added: [],
					modified: [],
					removed: [],
					nextCursor: 'cursor-synthetic-quiet'
				}),
			accountsGet: () => Effect.succeed(bankAccounts)
		});

		expect(await held()).toEqual([
			expect.objectContaining({ name: 'Sample Savings', mask: '4321', rows: 2 })
		]);
	});

	test("is named on a later sync when an overlapping sync's older answer left it out", async () => {
		const { syncWith, held } = await connectedBudget();
		const cardId = 'account-synthetic-card';
		const bankDown = new PlaidApi({
			error_code: 'INSTITUTION_NOT_RESPONDING',
			status: 400,
			request_id: 'request-synthetic-overlap'
		});
		const quiet = { ...page, added: [], modified: [], removed: [] };
		await syncWith({
			transactionsSync: () => Effect.succeed(rowsFor(savingsId)),
			accountsGet: () =>
				Effect.promise(() =>
					syncWith({
						transactionsSync: () =>
							Effect.succeed({ ...rowsFor(cardId), nextCursor: 'cursor-synthetic-b' }),
						accountsGet: () => Effect.fail(bankDown)
					})
				).pipe(Effect.as(bankAccounts))
		});
		expect(await held()).toContainEqual(expect.objectContaining({ name: null, rows: 2 }));

		await syncWith({
			transactionsSync: () => Effect.succeed({ ...quiet, nextCursor: 'cursor-synthetic-c' }),
			accountsGet: () =>
				Effect.succeed([
					...bankAccounts,
					{ externalId: cardId, name: 'Sample Card', mask: '7310', kind: 'cash', balance: -89_990 }
				])
		});

		expect((await held()).map(({ name }) => name).sort()).toEqual([
			'Sample Card',
			'Sample Savings'
		]);
	});

	test('a batch applied again, after the bank changed mid-update, holds its rows once', async () => {
		const { sync, held } = await connectedBudget();
		const more = (n: number): SyncPage => ({
			added: [],
			modified: [],
			removed: [],
			nextCursor: `cursor-synthetic-more-${String(n)}`,
			hasMore: true
		});
		const bankChanged = new PlaidApi({
			error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION',
			status: 400,
			request_id: 'request-synthetic-5'
		});
		const first = { ...rowsFor(savingsId), nextCursor: 'cursor-synthetic-a', hasMore: true };

		await sync(first, more(1), more(2), bankChanged, rowsFor(savingsId));

		expect(await held()).toMatchObject([{ rows: 2 }]);
	});

	test('mapped to an Account that already imported its history, adds no duplicates', async () => {
		const { owner, sync, held, heldId, transactions, checking } = await connectedBudget();
		await sync(page);
		const migrated = rowsFor('account-synthetic-checking-new');
		const extra = {
			...payroll,
			account_id: 'account-synthetic-checking-new',
			transaction_id: 'txn-synthetic-new-3',
			date: '2026-08-20',
			amount: -1_299,
			merchant_name: 'Sample Books'
		};
		await sync({ ...migrated, added: [...migrated.added, extra] });

		await owner.mutation(api.heldAccounts.map, {
			connectionAccountId: await heldId(),
			accountId: checking
		});

		expect((await held()).map((account) => account.name)).toEqual(['Sample Savings']);
		const rows = await transactions(checking);
		expect(rows.map((row) => [row.date, row.amount, row.payeeName])).toEqual([
			['2026-08-20', -1_299, 'Sample Books'],
			['2026-08-15', 231_042, 'SAMPLE PAYROLL'],
			['2026-08-14', -4_250, 'Sample Grocer']
		]);
		expect(rows.map((row) => row.bankRows.length)).toEqual([1, 2, 2]);
	});

	test("mapped, its rows Match the owner's hand-entered Transaction", async () => {
		const { owner, sync, heldId, transactions, checking } = await connectedBudget();
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			date: '2026-08-13',
			amount: -4_250,
			payee: 'Grocer',
			memo: ''
		});
		await sync(rowsFor('account-synthetic-checking-new'));

		await owner.mutation(api.heldAccounts.map, {
			connectionAccountId: await heldId(),
			accountId: checking
		});

		expect((await transactions(checking)).map((row) => [row.amount, row.payeeName])).toEqual([
			[231_042, 'SAMPLE PAYROLL'],
			[-4_250, 'Grocer']
		]);
	});

	test('mapping brings in every held row, however many', async () => {
		vi.useFakeTimers();
		const { t, owner, sync, heldId, transactions, checking } = await connectedBudget();
		const many = Array.from({ length: HELD_BATCH + 20 }, (_, n) => ({
			...payroll,
			account_id: savingsId,
			transaction_id: `txn-synthetic-many-${String(n)}`,
			amount: 100 + n
		}));
		await sync({ ...page, added: many });

		await owner.mutation(api.heldAccounts.map, {
			connectionAccountId: await heldId(),
			accountId: checking
		});
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await transactions(checking)).toHaveLength(HELD_BATCH + 20);
		expect(await owner.query(api.heldAccounts.list, {})).toEqual([]);
	});

	test('can become a new Account, whose starting balance Budge suggests from Plaid', async () => {
		const { owner, sync, heldId, transactions, suggest, balanceOf } = await connectedBudget();
		await sync(rowsFor(savingsId));

		const savings = await owner.mutation(api.heldAccounts.createAccount, {
			connectionAccountId: await heldId(),
			name: 'Savings',
			kind: 'cash'
		});

		expect(await transactions(savings)).toHaveLength(2);
		const suggestion = await suggest(savings);
		expect(suggestion).toEqual({
			kind: 'suggested',
			startingBalance: 300_000 - 231_042 + 4_250,
			bankBalance: 300_000,
			imported: { count: 2, total: 231_042 - 4_250, first: '2026-08-14', last: '2026-08-15' },
			source: { bankName: 'Sample Savings', mask: '4321', connectionName: 'Sample Bank' }
		});
		if (suggestion.kind !== 'suggested') return;

		await owner.mutation(api.accounts.setStartingBalance, {
			accountId: savings,
			startingBalance: suggestion.startingBalance
		});

		expect(await balanceOf(savings)).toBe(300_000);
		const [startingBalance] = (
			await owner.query(api.transactions.list, {
				accountId: savings,
				paginationOpts: { numItems: 10, cursor: null }
			})
		).page.filter((row) => row.payeeName === 'Starting Balance');
		expect(startingBalance).toMatchObject({ date: cutoverDate, amount: 73_208 });
	});

	test('the suggestion counts an imported row the owner marked uncleared, but not one the bank removed', async () => {
		const { owner, sync, heldId, transactions, suggest } = await connectedBudget();
		await sync(rowsFor(savingsId));
		const savings = await owner.mutation(api.heldAccounts.createAccount, {
			connectionAccountId: await heldId(),
			name: 'Savings',
			kind: 'cash'
		});
		const imported = await transactions(savings);
		const grocer = imported.find((row) => row.amount === -4_250);
		const paycheck = imported.find((row) => row.amount === 231_042);
		assert(grocer !== undefined && paycheck !== undefined, 'expected both imported rows');
		await owner.mutation(api.transactions.setCleared, {
			transactionId: grocer._id,
			cleared: false
		});
		await owner.mutation(api.transactions.approve, { transactionId: paycheck._id });

		await sync({
			...page,
			added: [],
			removed: [{ transaction_id: `${savingsId}-txn-synthetic-2`, account_id: savingsId }]
		});

		expect(await suggest(savings)).toMatchObject({
			kind: 'suggested',
			startingBalance: 300_000 + 4_250
		});
	});

	test('the suggestion counts a row the bank removed once a statement row behind ten removed ones still backs it', async () => {
		const { owner, t, sync, heldId, transactions, suggest } = await connectedBudget();
		await sync(rowsFor(savingsId));
		const savings = await owner.mutation(api.heldAccounts.createAccount, {
			connectionAccountId: await heldId(),
			name: 'Savings',
			kind: 'cash'
		});
		const paycheck = (await transactions(savings)).find((row) => row.amount === 231_042);
		assert(paycheck !== undefined, 'expected the imported paycheck');
		await owner.mutation(api.transactions.approve, { transactionId: paycheck._id });
		await sync({
			...page,
			added: [],
			removed: [{ transaction_id: `${savingsId}-txn-synthetic-2`, account_id: savingsId }]
		});
		await t.run(async (ctx) => {
			const statementRow = {
				accountId: savings,
				date: paycheck.date,
				amount: paycheck.amount,
				bankText: 'SAMPLE STATEMENT ROW',
				transactionId: paycheck._id,
				matched: true
			};
			for (let index = 0; index < 10; index++) {
				await ctx.db.insert('imports', { ...statementRow, source: 'qfx', state: 'removed' });
			}
			await ctx.db.insert('imports', { ...statementRow, source: 'csv', state: 'linked' });
		});

		expect(await suggest(savings)).toMatchObject({
			kind: 'suggested',
			startingBalance: 300_000 - 231_042 + 4_250
		});
	});

	test('among many other bank Accounts, is still listed and still gets a suggestion', async () => {
		const { owner, t, sync, heldId, suggest } = await connectedBudget();
		const otherConnections = 21;
		const accountsEach = 48;
		await t.run(async (ctx) => {
			for (let bank = 0; bank < otherConnections; bank++) {
				const otherConnection = await ctx.db.insert('bankConnections', {
					name: `Other Sample Bank ${String(bank)}`,
					status: 'ok',
					provider: {
						kind: 'plaid',
						itemId: `item-synthetic-other-${String(bank)}`,
						encryptedToken: `token-synthetic-other-${String(bank)}`
					}
				});
				for (let n = 0; n < accountsEach; n++) {
					await ctx.db.insert('connectionAccounts', {
						connectionId: otherConnection,
						externalId: `account-synthetic-other-${String(bank)}-${String(n)}`,
						state: 'ignored'
					});
				}
			}
		});
		await sync(rowsFor(savingsId));

		const savings = await owner.mutation(api.heldAccounts.createAccount, {
			connectionAccountId: await heldId(),
			name: 'Savings',
			kind: 'cash'
		});

		expect(await suggest(savings)).toMatchObject({ kind: 'suggested' });
	});

	test('an Account with no Bank Connection gets no suggestion, and its evidence names no bank Account', async () => {
		const { owner, suggest } = await connectedBudget();
		const wallet = await owner.mutation(api.accounts.create, {
			name: 'Wallet',
			kind: 'cash',
			startingBalance: 2_000
		});

		expect(await suggest(wallet)).toEqual({ kind: 'notSynced' });
		expect(
			await owner.query(api.heldAccounts.startingBalanceEvidence, { accountId: wallet })
		).toMatchObject({ source: null });
	});

	test('ignored, drops its rows and stays ignored on later syncs', async () => {
		const { owner, sync, heldId, held, transactions } = await connectedBudget();
		await sync(rowsFor(savingsId));

		await owner.mutation(api.heldAccounts.ignore, { connectionAccountId: await heldId() });
		expect(await held()).toEqual([]);

		expect(await sync(rowsFor(savingsId, 'later'))).toMatchObject({ added: 0, held: 0 });
		expect(await held()).toEqual([]);
		expect(await transactions()).toEqual([]);
	});

	test('only a held bank Account can be mapped or ignored', async () => {
		const { owner, sync, heldId, checking } = await connectedBudget();
		await sync(rowsFor(savingsId));
		const connectionAccountId = await heldId();
		await owner.mutation(api.heldAccounts.ignore, { connectionAccountId });

		expect(
			await publicErrorCode(
				owner.mutation(api.heldAccounts.map, { connectionAccountId, accountId: checking })
			)
		).toBe('INVALID_INPUT');
		expect(
			await publicErrorCode(owner.mutation(api.heldAccounts.ignore, { connectionAccountId }))
		).toBe('INVALID_INPUT');
	});
});

describe('a bank Account the owner stops syncing', () => {
	test('keeps its Transactions, imports nothing later, and once brought back waits for setup with its type', async () => {
		const { owner, sync, held, transactions, checking, connectionId } = await connectedBudget();
		await sync(rowsFor(checkingId));
		const imported = await transactions(checking);
		expect(imported.length).toBeGreaterThan(0);
		const [connection] = await owner.query(api.bankConnections.list, { now: Date.now() });
		const feed = connection?.feeds[0];
		assert(feed !== undefined, 'Checking is fed by the connection');

		await owner.mutation(api.heldAccounts.stopSyncing, {
			connectionAccountId: feed.connectionAccountId
		});
		expect(await sync(rowsFor(checkingId, 'later'))).toMatchObject({ added: 0, held: 0 });
		expect(await transactions(checking)).toEqual(imported);
		expect(await owner.query(api.bankConnections.list, { now: Date.now() })).toMatchObject([
			{ _id: connectionId, feeds: [], ignored: [{ connectionAccountId: feed.connectionAccountId }] }
		]);

		await owner.mutation(api.heldAccounts.restore, {
			connectionAccountId: feed.connectionAccountId
		});
		expect(await sync(rowsFor(checkingId, 'after'))).toMatchObject({ added: 0, held: 2 });
		expect(
			(await held()).find((account) => account._id === feed.connectionAccountId)
		).toMatchObject({
			kind: 'cash',
			rows: 2
		});
		expect(
			await publicErrorCode(
				owner.mutation(api.heldAccounts.stopSyncing, {
					connectionAccountId: feed.connectionAccountId
				})
			)
		).toBe('INVALID_INPUT');
	});

	test('set up anew in another Account, says where its earlier Transactions still are until each is moved or deleted', async () => {
		const { owner, sync, heldId, transactions, checking } = await connectedBudget();
		await sync(rowsFor(checkingId));
		const feeds = async () =>
			(await owner.query(api.bankConnections.list, { now: Date.now() }))[0]?.feeds ?? [];
		const [checkingFeed] = await feeds();
		assert(checkingFeed !== undefined, 'Checking is fed by the connection');
		expect(checkingFeed).toMatchObject({ name: 'Checking', historyIn: null });
		const { connectionAccountId } = checkingFeed;

		await owner.mutation(api.heldAccounts.stopSyncing, { connectionAccountId });
		await owner.mutation(api.heldAccounts.restore, { connectionAccountId });
		await sync(rowsFor(checkingId, 'after'));
		const plus = await owner.mutation(api.heldAccounts.createAccount, {
			connectionAccountId: await heldId(),
			name: 'Checking Plus',
			kind: 'cash'
		});
		const stillInChecking = {
			name: 'Checking Plus',
			historyIn: { accountId: checking, name: 'Checking' }
		};
		expect(await feeds()).toMatchObject([stillInChecking]);

		const [moved, deleted] = await transactions(checking);
		assert(moved !== undefined && deleted !== undefined, 'Checking kept two earlier rows');
		await owner.mutation(api.transactions.update, {
			transactionId: moved._id,
			accountId: plus,
			date: moved.date,
			amount: moved.amount,
			payee: moved.payeeName ?? '',
			memo: moved.memo ?? ''
		});
		expect(await feeds()).toMatchObject([stillInChecking]);

		await owner.mutation(api.transactions.remove, { transactionId: deleted._id });
		expect(await feeds()).toMatchObject([{ name: 'Checking Plus', historyIn: null }]);
	});
});

describe('the Bank list', () => {
	test('shows the bank Accounts a connection syncs or ignores while 50 others wait for setup', async () => {
		const { owner, t, connectionId } = await connectedBudget();
		await t.mutation(internal.heldAccounts.recordAccounts, {
			connectionId,
			accounts: listedAccounts(0, 50)
		});
		await t.mutation(internal.heldAccounts.recordAccounts, {
			connectionId,
			accounts: [
				{ externalId: 'account-synthetic-z-brokerage', name: 'Sample Brokerage', kind: 'cash' },
				{ externalId: 'account-synthetic-z-loan', name: 'Sample Loan', kind: 'cash' }
			]
		});
		const [brokerage, loan] = await t.run((ctx) =>
			Promise.all(
				['account-synthetic-z-brokerage', 'account-synthetic-z-loan'].map((externalId) =>
					findConnectionAccount(ctx, connectionId, externalId)
				)
			)
		);
		assert(brokerage && loan, 'the late bank Accounts were recorded');
		await owner.mutation(api.heldAccounts.createAccount, {
			connectionAccountId: brokerage._id,
			name: 'Brokerage',
			kind: 'cash'
		});
		await owner.mutation(api.heldAccounts.ignore, { connectionAccountId: loan._id });

		const [listed] = await owner.query(api.bankConnections.list, { now: Date.now() });

		expect(listed?.feeds.map(({ name }) => name)).toEqual(['Checking', 'Brokerage']);
		expect(listed?.ignored.map(({ name }) => name)).toEqual(['Sample Loan']);
	});

	test("says which bank Account feeds each Account, and that its starting balance is unconfirmed until the owner sets it, again after it's mapped anew", async () => {
		const { owner, sync, heldId } = await connectedBudget();
		await sync(rowsFor(savingsId));
		const savings = await owner.mutation(api.heldAccounts.createAccount, {
			connectionAccountId: await heldId(),
			name: 'Savings',
			kind: 'cash'
		});
		const feeds = async () =>
			(await owner.query(api.bankConnections.list, { now: Date.now() }))[0]?.feeds ?? [];

		expect(await feeds()).toMatchObject([
			{
				name: 'Checking',
				bankName: 'Sample Checking',
				mask: '0042',
				startingBalanceConfirmed: false
			},
			{ name: 'Savings', bankName: 'Sample Savings', mask: '4321', startingBalanceConfirmed: false }
		]);

		await owner.mutation(api.accounts.setStartingBalance, {
			accountId: savings,
			startingBalance: 73_208
		});
		expect(await feeds()).toMatchObject([
			{ name: 'Checking', startingBalanceConfirmed: false },
			{ name: 'Savings', startingBalanceConfirmed: true }
		]);

		const savingsFeed = (await feeds()).find((feed) => feed.accountId === savings);
		assert(savingsFeed !== undefined, 'Savings is fed by the connection');
		const { connectionAccountId } = savingsFeed;
		await owner.mutation(api.heldAccounts.stopSyncing, { connectionAccountId });
		await owner.mutation(api.heldAccounts.restore, { connectionAccountId });
		await owner.mutation(api.heldAccounts.map, { connectionAccountId, accountId: savings });
		expect(await feeds()).toMatchObject([
			{ name: 'Checking', startingBalanceConfirmed: false },
			{ name: 'Savings', startingBalanceConfirmed: false }
		]);
	});

	test('a confirmed starting balance is unconfirmed again once the cutover date changes, until the owner sets it for the new date', async () => {
		const { owner, sync, heldId } = await connectedBudget();
		await sync(rowsFor(savingsId));
		const savings = await owner.mutation(api.heldAccounts.createAccount, {
			connectionAccountId: await heldId(),
			name: 'Savings',
			kind: 'cash'
		});
		const savingsConfirmed = async () =>
			(await owner.query(api.bankConnections.list, { now: Date.now() }))[0]?.feeds.find(
				(feed) => feed.accountId === savings
			)?.startingBalanceConfirmed;
		await owner.mutation(api.accounts.setStartingBalance, {
			accountId: savings,
			startingBalance: 73_208
		});
		expect(await savingsConfirmed()).toBe(true);

		await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-07-01' });
		expect(await savingsConfirmed()).toBe(false);

		await owner.mutation(api.accounts.setStartingBalance, {
			accountId: savings,
			startingBalance: 73_208
		});
		expect(await savingsConfirmed()).toBe(true);
	});
});

describe('a removed Bank Connection', () => {
	let signedOut: unknown[];

	function useBankSync() {
		vi.stubEnv('PLAID_CLIENT_ID', 'client-id-synthetic');
		vi.stubEnv('PLAID_SECRET', 'secret-synthetic-not-real');
		vi.stubEnv('BUDGE_TOKEN_KEY', tokenKey);
	}

	beforeEach(() => {
		signedOut = [];
		useBankSync();
		stubPlaid(async (url, init) => {
			assert(url.pathname === '/item/remove', `Unexpected Plaid call ${url.pathname}`);
			signedOut.push(await new Response(init?.body).json());
			return Response.json({ request_id: 'request-synthetic' });
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	async function removeAndSettle(
		{ owner, t }: Awaited<ReturnType<typeof connectedBudget>>,
		connectionId: Id<'bankConnections'>
	) {
		vi.useFakeTimers();
		await owner.action(api.bankConnections.remove, { connectionId });
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		vi.useRealTimers();
	}

	const bankAccountCount = ({ t }: Awaited<ReturnType<typeof connectedBudget>>) =>
		t.run(async (ctx) => (await ctx.db.query('connectionAccounts').collect()).length);

	test('leaves its Transactions, signs out at the bank, and drops its bank Accounts and held rows', async () => {
		const backend = await connectedBudget();
		const { owner, t, sync, held, transactions, checking, connectionId } = backend;
		await sync(rowsFor(checkingId));
		await sync(rowsFor(savingsId));
		const imported = await transactions(checking);
		expect(await held()).toHaveLength(1);

		await removeAndSettle(backend, connectionId);

		expect(signedOut).toEqual([{ access_token: accessToken }]);
		expect(await owner.query(api.bankConnections.list, { now: Date.now() })).toEqual([]);
		expect(await held()).toEqual([]);
		expect(await transactions(checking)).toEqual(imported);
		expect(
			await t.run(async (ctx) => ({
				bankAccounts: (await ctx.db.query('connectionAccounts').collect()).length,
				heldRows: (
					await ctx.db
						.query('imports')
						.withIndex('by_state_transactionId', (q) => q.eq('state', 'held'))
						.collect()
				).length
			}))
		).toEqual({ bankAccounts: 0, heldRows: 0 });
	});

	test('drops every bank Account the bank listed, past the first 50', async () => {
		const backend = await connectedBudget();
		const { t, connectionId } = backend;
		for (const [from, count] of [
			[0, 50],
			[50, 1]
		] as const) {
			await t.mutation(internal.heldAccounts.recordAccounts, {
				connectionId,
				accounts: listedAccounts(from, count)
			});
		}
		expect(await bankAccountCount(backend)).toBe(52);

		await removeAndSettle(backend, connectionId);

		expect(await bankAccountCount(backend)).toBe(0);
	});

	test('records nothing when the bank lists its Accounts after the removal', async () => {
		const backend = await connectedBudget();
		const { t, connectionId } = backend;
		await removeAndSettle(backend, connectionId);

		await t.mutation(internal.heldAccounts.recordAccounts, {
			connectionId,
			accounts: listedAccounts(0, 1)
		});

		expect(await bankAccountCount(backend)).toBe(0);
	});

	test.each(['PLAID_SECRET', 'BUDGE_TOKEN_KEY'])(
		'on a server without %s, is kept with its bank login until Budge can sign out at the bank',
		async (name) => {
			const backend = await connectedBudget();
			const { owner, connectionId } = backend;
			vi.stubEnv(name, undefined);

			expect(
				await publicErrorOf(owner.action(api.bankConnections.remove, { connectionId }))
			).toEqual({
				code: 'BANK_SYNC_UNAVAILABLE',
				message:
					"Bank sync isn't set up on this server, so Budge can't sign out of this bank yet. Set it up, then remove the connection."
			});
			expect(signedOut).toEqual([]);
			expect(await owner.query(api.bankConnections.list, { now: Date.now() })).toHaveLength(1);

			useBankSync();
			await removeAndSettle(backend, connectionId);

			expect(signedOut).toEqual([{ access_token: accessToken }]);
			expect(await owner.query(api.bankConnections.list, { now: Date.now() })).toEqual([]);
		}
	);

	test('accepts ITEM_NOT_FOUND when removing the remote Item', async () => {
		const { t, connectionId } = await connectedBudget();
		const removed: string[] = [];
		await t.action(async (ctx) => {
			const exit = await Effect.runPromiseExit(
				removeItem(connectionId).pipe(
					Effect.provide(
						Layer.mergeAll(
							PlaidClient.layerTest({
								itemRemove: (token) => {
									removed.push(token);
									return Effect.fail(
										new PlaidApi({ error_code: 'ITEM_NOT_FOUND', request_id: '', status: 400 })
									);
								}
							}),
							TokenCipher.layer(tokenKey),
							SyncStore.layer(ctx)
						)
					)
				)
			);
			assert(Exit.isSuccess(exit), 'removing an item Plaid already forgot succeeds');
		});
		expect(removed).toEqual([accessToken]);
	});
});

describe('the bank changes a row it holds for an unknown Account', () => {
	const grocerId = `${savingsId}-txn-synthetic-1`;
	const changes = (part: Partial<SyncPage>): SyncPage => ({ ...page, added: [], ...part });
	const grocerAt = (amount: number) => {
		const [grocer] = rowsFor(savingsId).added;
		assert(grocer !== undefined, 'the fixture has a grocer row');
		return { ...grocer, amount };
	};

	test('mapping brings in what the bank last said, not what it first sent', async () => {
		const { owner, sync, heldId, transactions, checking } = await connectedBudget();
		await sync(rowsFor(savingsId));
		await sync(changes({ modified: [grocerAt(-4_550)] }));

		await owner.mutation(api.heldAccounts.map, {
			connectionAccountId: await heldId(),
			accountId: checking
		});

		expect((await transactions(checking)).map((row) => row.amount)).toEqual([231_042, -4_550]);
	});

	test('a removed row is never imported, even when an earlier page arrives again', async () => {
		const { owner, sync, heldId, transactions, checking } = await connectedBudget();
		await sync(rowsFor(savingsId));
		await sync(changes({ removed: [{ transaction_id: grocerId, account_id: savingsId }] }));
		await sync(rowsFor(savingsId));

		await owner.mutation(api.heldAccounts.map, {
			connectionAccountId: await heldId(),
			accountId: checking
		});

		expect((await transactions(checking)).map((row) => row.amount)).toEqual([231_042]);
	});

	test('a change to an Account the bank never sent rows for holds that row', async () => {
		const { sync, held } = await connectedBudget();

		expect(await sync(changes({ modified: [grocerAt(-4_550)] }))).toMatchObject({ held: 1 });

		expect(await held()).toMatchObject([{ name: 'Sample Savings', rows: 1 }]);
	});

	test('a change that arrives while mapping is still bringing rows in is kept', async () => {
		vi.useFakeTimers();
		const { t, owner, sync, heldId, transactions, checking } = await connectedBudget();
		const many = Array.from({ length: HELD_BATCH + 2 }, (_, n) => ({
			...payroll,
			account_id: savingsId,
			transaction_id: `txn-synthetic-many-${String(n)}`,
			amount: -(1 + n)
		}));
		await sync({ ...page, added: many });
		await owner.mutation(api.heldAccounts.map, {
			connectionAccountId: await heldId(),
			accountId: checking
		});
		const last = many.at(-1);
		assert(last !== undefined, 'there are rows');

		await sync(changes({ modified: [{ ...last, amount: -999 }], removed: [] }));
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		const amounts = (await transactions(checking)).map((row) => row.amount);
		expect(amounts).toHaveLength(HELD_BATCH + 2);
		expect(amounts).toContain(-999);
		expect(amounts).not.toContain(-(HELD_BATCH + 2));
	});
});

describe('a suggested starting balance', () => {
	const checkingReporting = (balance: number | null): BankAccount[] => [
		{ externalId: checkingId, name: 'Sample Checking', mask: '0042', kind: 'cash', balance }
	];

	test("is the bank's balance, even zero, with no imported dates when nothing came in, and is withheld when the bank has no balance or no such Account", async () => {
		const { checking, suggest } = await connectedBudget();

		expect(await suggest(checking, checkingReporting(0))).toEqual({
			kind: 'suggested',
			startingBalance: 0,
			bankBalance: 0,
			imported: { count: 0, total: 0, first: null, last: null },
			source: { bankName: null, mask: null, connectionName: 'Sample Bank' }
		});
		expect(await suggest(checking, checkingReporting(null))).toEqual({ kind: 'noBalance' });
		expect(await suggest(checking, [])).toEqual({ kind: 'noBalance' });
	});

	test('waits until every held row is brought in', async () => {
		vi.useFakeTimers();
		const { t, owner, sync, heldId, suggest } = await connectedBudget();
		const many = Array.from({ length: HELD_BATCH + 20 }, (_, n) => ({
			...payroll,
			account_id: savingsId,
			transaction_id: `txn-synthetic-many-${String(n)}`,
			amount: 1 + n
		}));
		await sync({ ...page, added: many });
		const savings = await owner.mutation(api.heldAccounts.createAccount, {
			connectionAccountId: await heldId(),
			name: 'Savings',
			kind: 'cash'
		});

		expect(await suggest(savings)).toEqual({ kind: 'importing' });

		await t.finishAllScheduledFunctions(vi.runAllTimers);
		const imported = many.reduce((sum, row) => sum + row.amount, 0);
		expect(await suggest(savings)).toMatchObject({
			kind: 'suggested',
			startingBalance: 300_000 - imported
		});
	});

	test('what it is based on, apart from the bank balance, is known without asking the bank and counts only bank-backed Transactions since the cutover date', async () => {
		const { owner, sync, heldId } = await connectedBudget();
		await sync(rowsFor(savingsId));
		const savings = await owner.mutation(api.heldAccounts.createAccount, {
			connectionAccountId: await heldId(),
			name: 'Savings',
			kind: 'cash'
		});
		await owner.mutation(api.transactions.create, {
			accountId: savings,
			date: '2026-08-20',
			amount: -1_500,
			payee: 'Sample Bakery',
			memo: ''
		});

		expect(
			await owner.query(api.heldAccounts.startingBalanceEvidence, { accountId: savings })
		).toEqual({
			since: cutoverDate,
			imported: { count: 2, total: 231_042 - 4_250, first: '2026-08-14', last: '2026-08-15' },
			source: { bankName: 'Sample Savings', mask: '4321', connectionName: 'Sample Bank' }
		});
	});

	const movedReporting = (balance: number): BankAccount[] => [
		{ externalId: movedCheckingId, name: 'Sample Checking', mask: '0042', kind: 'cash', balance }
	];

	test('after the Account is mapped to a newer bank Account of its connection, comes from the newer one, which it and its evidence name', async () => {
		const { owner, sync, syncWith, heldId, suggest, checking } = await connectedBudget();
		await sync(page);
		await syncWith({
			transactionsSync: () => Effect.succeed(rowsFor(movedCheckingId)),
			accountsGet: () =>
				Effect.succeed([
					...bankAccounts,
					{
						externalId: movedCheckingId,
						name: 'Sample Checking Plus',
						mask: '0077',
						kind: 'cash',
						balance: null
					}
				])
		});
		await owner.mutation(api.heldAccounts.map, {
			connectionAccountId: await heldId(),
			accountId: checking
		});
		const newer = { bankName: 'Sample Checking Plus', mask: '0077', connectionName: 'Sample Bank' };

		expect(await suggest(checking, movedReporting(150_000))).toMatchObject({
			kind: 'suggested',
			startingBalance: 150_000 - 231_042 + 4_250,
			bankBalance: 150_000,
			source: newer
		});
		expect(
			await owner.query(api.heldAccounts.startingBalanceEvidence, { accountId: checking })
		).toMatchObject({ source: newer });
	});

	test('waits for rows still coming in from any bank Account mapped to the Account', async () => {
		vi.useFakeTimers();
		const { t, owner, sync, heldId, connectNewBank, suggest, checking } = await connectedBudget();
		const many = Array.from({ length: HELD_BATCH + 20 }, (_, n) => ({
			...payroll,
			account_id: savingsId,
			transaction_id: `txn-synthetic-many-${String(n)}`,
			amount: 1 + n
		}));
		await sync({ ...page, added: many });
		await connectNewBank();
		await owner.mutation(api.heldAccounts.map, {
			connectionAccountId: await heldId(),
			accountId: checking
		});

		expect(await suggest(checking, movedReporting(150_000))).toEqual({ kind: 'importing' });

		await t.finishAllScheduledFunctions(vi.runAllTimers);
		const imported = many.reduce((sum, row) => sum + row.amount, 0);
		expect(await suggest(checking, movedReporting(150_000))).toMatchObject({
			kind: 'suggested',
			startingBalance: 150_000 - imported
		});
	});

	describe('asked while a sync is unfinished', () => {
		const imported = 231_042 - 4_250;

		beforeEach(() => {
			vi.stubEnv('PLAID_CLIENT_ID', 'client-id-synthetic');
			vi.stubEnv('PLAID_SECRET', 'secret-synthetic-not-real');
			vi.stubEnv('BUDGE_TOKEN_KEY', tokenKey);
			stubPlaid((url) => {
				assert(url.pathname === '/accounts/get', `Unexpected Plaid call ${url.pathname}`);
				const accounts = [
					{
						account_id: checkingId,
						name: 'Sample Checking',
						mask: '0042',
						type: 'depository',
						balances: { current: 1_200 }
					}
				];
				return Promise.resolve(
					new Response(JSON.stringify({ accounts, request_id: 'request-synthetic' }), {
						status: 200,
						headers: { 'content-type': 'application/json' }
					})
				);
			});
		});

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		test('while the sync is running, says the rows are still coming in', async () => {
			const { owner, checking, syncWith } = await connectedBudget();
			const suggestion = () =>
				owner.action(api.heldAccounts.suggestStartingBalance, { accountId: checking });
			const bank = gate();
			const syncAsked = gate();
			const running = syncWith({
				transactionsSync: () =>
					Effect.promise(async () => {
						syncAsked.open();
						await bank.opened;
						return page;
					})
			});
			await syncAsked.opened;

			expect(await suggestion()).toEqual({ kind: 'importing' });

			bank.open();
			await running;
			expect(await suggestion()).toMatchObject({
				kind: 'suggested',
				startingBalance: 120_000 - imported
			});
		});

		test("while a newer Bank Connection's sync for the Account is running, says the rows are still coming in", async () => {
			const { owner, checking, connectNewBank } = await connectedBudget();
			const suggestion = () =>
				owner.action(api.heldAccounts.suggestStartingBalance, { accountId: checking });
			const syncNewBank = await connectNewBank();
			const bank = gate();
			const syncAsked = gate();
			const running = syncNewBank({
				transactionsSync: () =>
					Effect.promise(async () => {
						syncAsked.open();
						await bank.opened;
						return rowsFor(movedCheckingId);
					})
			});
			await syncAsked.opened;

			expect(await suggestion()).toEqual({ kind: 'importing' });

			bank.open();
			await running;
			expect(await suggestion()).toMatchObject({ kind: 'suggested' });
		});

		test("after a sync stopped before the bank's last page, says the rows are still coming in", async () => {
			const { owner, checking, sync } = await connectedBudget();
			const suggestion = () =>
				owner.action(api.heldAccounts.suggestStartingBalance, { accountId: checking });
			await sync({ ...page, nextCursor: 'cursor-synthetic-more', hasMore: true });

			expect(await suggestion()).toEqual({ kind: 'importing' });

			await sync(page);
			expect(await suggestion()).toMatchObject({
				kind: 'suggested',
				startingBalance: 120_000 - imported
			});
		});
	});
});

afterEach(() => {
	vi.useRealTimers();
});
