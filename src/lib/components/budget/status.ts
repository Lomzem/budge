import type { BudgetView } from '$lib/budget.svelte';
import { formatDate, ordinal } from '$lib/domain/dates';
import { formatCents } from '$lib/domain/money';

type CategoryBudget = BudgetView['groups'][number]['categories'][number];
export type TargetProgress = NonNullable<CategoryBudget['target']>;
export type TargetDefinition = TargetProgress['definition'];

/**
 * A Category's status in words, with its color. Color is never the only signal: every colored
 * amount has its status in words beside it, and the words are a Target bar's text equivalent.
 */
export function availableStatus(
	category: Pick<CategoryBudget, 'status' | 'available' | 'target'>
): { text: string; class: string } | undefined {
	switch (category.status) {
		case 'overspent':
			return {
				text: `Overspent by ${formatCents(-category.available)}`,
				class: 'text-destructive'
			};
		case 'underfunded':
			return {
				text: `${formatCents(category.target?.needed ?? 0)} more needed`,
				class: 'text-warning'
			};
		case 'funded':
			return { text: 'Funded', class: 'text-funded' };
		case 'empty':
			return undefined;
	}
}

/**
 * A Payment Category's notes in words: what it still waits on from each overspent Category, then
 * the card debt not yet covered. Empty for any other Category.
 */
export function paymentNotes(category: Pick<CategoryBudget, 'payment'>): string[] {
	const { payment } = category;
	if (payment === null) return [];
	const notes = payment.waitingOn.map((w) => `${formatCents(w.amount)} waiting on ${w.name}`);
	if (payment.uncovered > 0)
		notes.push(`${formatCents(payment.uncovered)} of card debt not yet covered`);
	return notes;
}

/** A Target in words, with a repeating By date Target's date as of the viewed month. */
export function describeTarget(target: TargetProgress): string {
	const { definition } = target;
	const amount = formatCents(definition.amount);
	if (definition.kind === 'monthly') {
		const what =
			definition.mode === 'refill'
				? `Refill up to ${amount} each month`
				: `Set aside ${amount} each month`;
		return definition.dueDay === undefined
			? what
			: `${what}, due on the ${ordinal(definition.dueDay)}`;
	}
	const by = `Have ${amount} Available by ${formatDate(target.dueDate ?? definition.firstDate)}`;
	const every = definition.everyMonths;
	if (every === undefined) return by;
	return every === 1
		? `${by}, repeating every month`
		: `${by}, repeating every ${String(every)} months`;
}
