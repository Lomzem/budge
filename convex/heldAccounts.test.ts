import { Effect, Exit, Layer } from 'effect';
import { afterEach, assert, describe, expect, test, vi } from 'vitest';

import { decodeSyncPage, type BankAccount, type SyncPage } from '../src/lib/domain/plaid';
import syncPage from '../src/lib/domain/fixtures/synthetic/plaid-sync-page.json';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { PlaidApi, PlaidClient } from './lib/plaidClient';
import { HELD_BATCH } from './heldAccounts';
import { setupConnection, suggestStartingBalance, SyncStore, syncConnection } from './lib/sync';
import { TokenCipher } from './lib/tokenCipher';
import { newBackend, publicErrorCode, useOwnerEnv } from './test.helper';

useOwnerEnv();

const cutoverDate = '2026-08-01';
const accessToken = 'access-token-synthetic-not-real';
const checkingId = 'account-synthetic-checking';
const savingsId = 'account-synthetic-savings';
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
	{ externalId: checkingId, name: 'Sample Checking', mask: '0042', balance: 120_000 },
	{ externalId: savingsId, name: 'Sample Savings', mask: '4321', balance: 300_000 }
];

type FakePlaid = Parameters<typeof PlaidClient.layerTest>[0];

async function connectedBudget() {
	const backend = newBackend();
	const { owner, t } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate });
	const checking = await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 100_000
	});
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
	const connectionId = await inAction(
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
	const suggest = (accountId: Id<'accounts'>) =>
		inAction(
			{
				accountsGet: (token, ids) => {
					expect(token).toBe(accessToken);
					return Effect.succeed(bankAccounts.filter((a) => ids?.includes(a.externalId)));
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
		suggest,
		held,
		heldId,
		transactions,
		balanceOf
	};
}

describe('a bank Account Budge does not know', () => {
	test('is held with its rows, named from Plaid, and imports nothing', async () => {
		const { sync, held, transactions } = await connectedBudget();

		expect(await sync(rowsFor(savingsId))).toMatchObject({ kind: 'synced', added: 0, held: 2 });

		expect(await held()).toEqual([
			expect.objectContaining({
				connectionName: 'Sample Bank',
				name: 'Sample Savings',
				mask: '4321',
				rows: 2
			})
		]);
		expect(await transactions()).toEqual([]);
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
		expect(suggestion).toEqual({ kind: 'suggested', startingBalance: 300_000 - 231_042 + 4_250 });
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

		expect(await suggest(savings)).toEqual({ kind: 'suggested', startingBalance: 300_000 + 4_250 });
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

	test('an Account with no Bank Connection gets no suggestion', async () => {
		const { owner, suggest } = await connectedBudget();
		const wallet = await owner.mutation(api.accounts.create, {
			name: 'Wallet',
			kind: 'cash',
			startingBalance: 2_000
		});

		expect(await suggest(wallet)).toEqual({ kind: 'notSynced' });
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

afterEach(() => {
	vi.useRealTimers();
});
