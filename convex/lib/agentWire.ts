import type { Infer } from 'convex/values';

import type { Id } from '../_generated/dataModel';
import type { accountRows } from '../accounts';
import type { budgetMonth } from '../budget';
import type { transactionPage } from '../transactions';

type BudgetMonth = Infer<typeof budgetMonth>;
type CategoryBudget = BudgetMonth['hidden'][number];
type TransactionPage = Infer<typeof transactionPage>;
type TransactionRow = TransactionPage['page'][number];

const dollars = (cents: number) => cents / 100;

const textOrNull = (text: string | null) => (text === null || text === '' ? null : text);

export function accountsForAgent(rows: Infer<typeof accountRows>) {
	return {
		accounts: rows.map(({ _id, balance, ...account }) => ({
			id: _id,
			...account,
			balance: dollars(balance)
		}))
	};
}

function categoryForAgent(category: CategoryBudget) {
	const { target, payment } = category;
	return {
		...category,
		priorAvailable: dollars(category.priorAvailable),
		assigned: dollars(category.assigned),
		activity: dollars(category.activity),
		available: dollars(category.available),
		target: target && {
			...target,
			definition: { ...target.definition, amount: dollars(target.definition.amount) },
			needed: dollars(target.needed)
		},
		payment: payment && {
			waitingOn: payment.waitingOn.map((c) => ({ ...c, amount: dollars(c.amount) })),
			uncovered: dollars(payment.uncovered)
		}
	};
}

export function budgetForAgent({
	readyToAssignId,
	...month
}: BudgetMonth & { readyToAssignId: Id<'categories'> | null }) {
	return {
		...month,
		readyToAssign: {
			id: readyToAssignId,
			amount: dollars(month.readyToAssign.amount),
			uncategorized: dollars(month.readyToAssign.uncategorized)
		},
		groups: month.groups.map((group) => ({
			...group,
			assigned: dollars(group.assigned),
			activity: dollars(group.activity),
			available: dollars(group.available),
			categories: group.categories.map(categoryForAgent)
		})),
		hidden: month.hidden.map(categoryForAgent),
		overspent: month.overspent.map((c) => ({ ...c, available: dollars(c.available) })),
		upcoming: month.upcoming.map((c) => ({ ...c, amount: dollars(c.amount) }))
	};
}

function kindOf(row: TransactionRow) {
	if (row.startingBalance) return 'startingBalance';
	if (row.transfer !== null) return 'transfer';
	return row.splits === null ? 'normal' : 'split';
}

function transactionForAgent(row: TransactionRow) {
	return {
		id: row._id,
		date: row.date,
		kind: kindOf(row),
		account: { id: row.accountId, name: row.accountName },
		payee: row.payeeName,
		category: row.categoryId === null ? null : { id: row.categoryId, name: row.categoryName ?? '' },
		amount: dollars(row.amount),
		memo: textOrNull(row.memo),
		cleared: row.cleared,
		reconciled: row.reconciled,
		approved: row.approved,
		transferAccount: row.transfer && { id: row.transfer.accountId, name: row.transfer.accountName },
		splits: (row.splits ?? []).map((line) => ({
			category: { id: line.categoryId, name: line.categoryName },
			amount: dollars(line.amount),
			memo: textOrNull(line.memo)
		})),
		bankText: row.bankRows.map((bankRow) => bankRow.bankText)
	};
}

export function transactionsForAgent(page: TransactionPage) {
	return {
		transactions: page.page.map(transactionForAgent),
		nextCursor: page.isDone ? null : page.continueCursor
	};
}
