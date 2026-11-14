import type { BudgetInput } from '../../src/lib/domain/budget';
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { everyRow, type ReadRows } from './readLimits';
import { readCutoverDate } from './settings';

export type BudgetRead =
	'categoryGroups' | 'categories' | 'assignments' | 'monthlyTotals' | 'transactionsAfterToday';

export type BudgetInputs = Omit<
	BudgetInput<Id<'categories'>, Id<'categoryGroups'>, Id<'accounts'>>,
	'assignments'
> & { assignments: readonly Doc<'assignments'>[] };

export async function readBudgetInput(
	ctx: QueryCtx,
	month: string,
	today: string,
	read: ReadRows<BudgetRead> = everyRow
): Promise<BudgetInputs> {
	const groups = await read('categoryGroups', ctx.db.query('categoryGroups'));
	const categories = await read('categories', ctx.db.query('categories'));
	const assignments = await read('assignments', ctx.db.query('assignments'));
	const monthlyTotals = await read('monthlyTotals', ctx.db.query('monthlyTotals'));

	const transactionsAfterToday = [];
	const readyToAssign = categories.filter((c) => c.kind === 'readyToAssign').map((c) => c._id);
	for (const categoryId of [undefined, ...readyToAssign]) {
		const later = ctx.db
			.query('transactions')
			.withIndex('by_category_date', (q) => q.eq('categoryId', categoryId).gt('date', today));
		for (const transaction of await read('transactionsAfterToday', later)) {
			const isTransferSideOrSplit =
				transaction.transferTransactionId !== undefined || transaction.split === true;
			if (isTransferSideOrSplit) continue;
			transactionsAfterToday.push({
				date: transaction.date,
				amount: transaction.amount,
				categoryId: transaction.categoryId ?? null
			});
		}
	}
	for (const categoryId of readyToAssign) {
		const later = ctx.db
			.query('transactionSplits')
			.withIndex('by_category_date', (q) => q.eq('categoryId', categoryId).gt('date', today));
		for (const line of await read('transactionsAfterToday', later)) {
			transactionsAfterToday.push({ date: line.date, amount: line.amount, categoryId });
		}
	}

	return {
		month,
		today,
		cutoverDate: await readCutoverDate(ctx),
		groups: groups.map((g) => ({
			id: g._id,
			name: g.name,
			position: g.position,
			kind: g.kind,
			hidden: g.hidden
		})),
		categories: categories.map((c) => ({
			id: c._id,
			groupId: c.groupId,
			name: c.name,
			position: c.position,
			kind: c.kind,
			hidden: c.hidden,
			target: c.target,
			accountId: c.accountId
		})),
		assignments,
		monthlyTotals,
		transactionsAfterToday
	};
}
