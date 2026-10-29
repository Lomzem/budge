import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery, type UseQueryReturn } from 'convex-svelte';
import { createContext } from 'svelte';

import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { addMonths, localToday, monthOf } from '$lib/domain/dates';

export type BudgetView = FunctionReturnType<typeof api.budget.month>;

/**
 * The budget for the selected month, live, with Ready to Assign. Construct once, in the app
 * layout, and share by context, so the month survives moving between screens.
 */
export class BudgetMonth {
	/** `YYYY-MM`; starts on the current month. */
	month = $state(monthOf(localToday()));
	/** The owner's local date, which decides when future-dated income counts. */
	today = $state(localToday());
	readonly #query: UseQueryReturn<typeof api.budget.month>;
	readonly #setAssigned = useMutation(api.budget.setAssigned);
	/** The selected month's budget, once it has loaded. */
	readonly view: BudgetView | undefined = $derived.by(() => {
		const data = this.#query.data;
		return data?.month === this.month ? data : undefined;
	});
	/** The same in every month, so it stays shown while another month loads. */
	readonly readyToAssign = $derived.by(() => this.#query.data?.readyToAssign);
	readonly error = $derived.by(() => this.#query.error);
	/** Also the same in every month, so Previous stays enabled while the next month loads. */
	readonly #firstMonth = $derived.by(() => this.#query.data?.firstMonth);
	/** Months before the cutover month have nothing to budget. */
	readonly canGoBack = $derived.by(() => {
		const first = this.#firstMonth;
		return first !== null && first !== undefined && this.month > first;
	});

	/**
	 * `enabled` turns the subscription on once the owner is signed in. Construct during component
	 * setup, which owns the midnight refresh timer.
	 */
	constructor(enabled: () => boolean) {
		this.#query = useQuery(
			api.budget.month,
			() => (enabled() ? { month: this.month, today: this.today } : 'skip'),
			{ keepPreviousData: true }
		);
		// Income dated today starts counting at midnight, even if Budge stays open and focused.
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

	/** Refreshes `today`, so income dated today starts counting after midnight. A same-day refresh changes nothing. */
	refreshToday() {
		this.today = localToday();
	}

	async setAssigned(categoryId: Id<'categories'>, amount: number) {
		await this.#setAssigned({ month: this.month, categoryId, amount });
	}
}

export const [getBudgetMonth, setBudgetMonth] = createContext<BudgetMonth>();
