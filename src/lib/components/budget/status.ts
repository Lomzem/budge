import type { BudgetView } from '$lib/budget.svelte';
import { formatDate, ordinal } from '$lib/domain/dates';
import { formatCents } from '$lib/domain/money';

type CategoryBudget = BudgetView['groups'][number]['categories'][number];
export type TargetProgress = NonNullable<CategoryBudget['target']>;
export type TargetDefinition = TargetProgress['definition'];

export function availableStatus(
	category: Pick<CategoryBudget, 'status' | 'available' | 'target' | 'payment'>
): { text: string; class: string } | undefined {
	if (category.status === 'overspent')
		return {
			text: `Overspent by ${formatCents(-category.available)}`,
			class: 'text-destructive'
		};
	const uncovered = category.payment?.uncovered ?? 0;
	if (uncovered > 0) return { text: uncoveredNote(uncovered), class: 'text-warning' };
	switch (category.status) {
		case 'underfunded':
			return {
				text: `${formatCents(category.target?.needed ?? 0)} more needed`,
				class: 'text-warning'
			};
		case 'funded':
			return { text: category.target ? 'Funded' : '', class: 'text-funded' };
		case 'empty':
			return undefined;
	}
}

function uncoveredNote(cents: number) {
	return `${formatCents(cents)} of card debt not yet covered`;
}

export function waitingNotes(category: Pick<CategoryBudget, 'payment'>): string[] {
	return (category.payment?.waitingOn ?? []).map(
		(w) => `${formatCents(w.amount)} waiting on ${w.name}`
	);
}

export function paymentNotes(category: Pick<CategoryBudget, 'payment'>): string[] {
	const uncovered = category.payment?.uncovered ?? 0;
	const notes = waitingNotes(category);
	return uncovered > 0 ? [...notes, uncoveredNote(uncovered)] : notes;
}

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
