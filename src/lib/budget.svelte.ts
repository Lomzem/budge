import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { useMutation, useQuery, type UseQueryReturn } from 'convex-svelte';
import { createContext } from 'svelte';

import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { addMonths, localToday, monthOf } from '$lib/domain/dates';

export type BudgetView = FunctionReturnType<typeof api.budget.month>;

export class BudgetMonth {
	month = $state(monthOf(localToday()));

	today = $state(localToday());
	readonly #query: UseQueryReturn<typeof api.budget.month>;
	readonly #setAssigned = useMutation(api.budget.setAssigned);
	readonly #moveMoney = useMutation(api.budget.moveMoney);
	readonly #cover = useMutation(api.budget.cover);
	readonly #assignTarget = useMutation(api.budget.assignTarget);
	readonly #setTarget = useMutation(api.categories.setTarget);

	readonly view: BudgetView | undefined = $derived.by(() => {
		const data = this.#query.data;
		return data?.month === this.month ? data : undefined;
	});

	readonly readyToAssign = $derived.by(() => this.#query.data?.readyToAssign);
	readonly error = $derived.by(() => this.#query.error);

	readonly #firstMonth = $derived.by(() => this.#query.data?.firstMonth);

	readonly canGoBack = $derived.by(() => {
		const first = this.#firstMonth;
		return first !== null && first !== undefined && this.month > first;
	});

	constructor(enabled: () => boolean) {
		this.#query = useQuery(
			api.budget.month,
			() => (enabled() ? { month: this.month, today: this.today } : 'skip'),
			{ keepPreviousData: true }
		);
		$effect(() => {
			const timer = setInterval(() => {
				this.refreshToday();
			}, 60_000);
			return () => {
				clearInterval(timer);
			};
		});
	}

	previous() {
		if (this.canGoBack) this.month = addMonths(this.month, -1);
	}

	next() {
		this.month = addMonths(this.month, 1);
	}

	refreshToday() {
		this.today = localToday();
	}

	async setAssigned(categoryId: Id<'categories'>, amount: number) {
		await this.#setAssigned({ month: this.month, categoryId, amount });
	}

	async moveMoney(
		fromCategoryId: Id<'categories'>,
		toCategoryId: Id<'categories'>,
		amount: number
	) {
		await this.#moveMoney({ month: this.month, fromCategoryId, toCategoryId, amount });
	}

	async cover(categoryId: Id<'categories'>) {
		await this.#cover({ month: this.month, categoryId });
	}

	async assignTarget(categoryId: Id<'categories'>) {
		await this.#assignTarget({ month: this.month, categoryId });
	}

	async setTarget(
		categoryId: Id<'categories'>,
		target: FunctionArgs<typeof api.categories.setTarget>['target']
	) {
		await this.#setTarget({ categoryId, target });
	}
}

export const [getBudgetMonth, setBudgetMonth] = createContext<BudgetMonth>();
