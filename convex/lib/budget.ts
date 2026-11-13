import type { BudgetInput } from '../../src/lib/domain/budget';
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { readCutoverDate } from './settings';

export type BudgetInputs = Omit<
	BudgetInput<Id<'categories'>, Id<'categoryGroups'>, Id<'accounts'>>,
	'assignments'
> & { assignments: readonly Doc<'assignments'>[] };

export async function readBudgetInput(
	ctx: QueryCtx,
	month: string,
	today: string
): Promise<BudgetInputs> {
	const groups = [];
	for await (const group of ctx.db.query('categoryGroups')) groups.push(group);
	const categories = [];
	for await (const category of ctx.db.query('categories')) categories.push(category);
	const assignments = [];
	for await (const row of ctx.db.query('assignments')) assignments.push(row);
	const monthlyTotals = [];
	for await (const row of ctx.db.query('monthlyTotals')) monthlyTotals.push(row);

	const transactionsAfterToday = [];
	const readyToAssign = categories.filter((c) => c.kind === 'readyToAssign').map((c) => c._id);
	for (const categoryId of [undefined, ...readyToAssign]) {
		const later = ctx.db
			.query('transactions')
			.withIndex('by_category_date', (q) => q.eq('categoryId', categoryId).gt('date', today));
		for await (const transaction of later) {
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
		for await (const line of later) {
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
