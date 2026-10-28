import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery, type UseQueryReturn } from 'convex-svelte';
import { createContext } from 'svelte';

import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';

export type Account = FunctionReturnType<typeof api.accounts.list>[number];

/**
 * The owner's Accounts in sidebar order, with balances, live. Construct once, in the app layout,
 * and share by context.
 */
export class Accounts {
	readonly #query: UseQueryReturn<typeof api.accounts.list>;
	readonly #reorder = useMutation(api.accounts.reorder);
	readonly all: Account[] = $derived.by(() => this.#query.data ?? []);
	readonly cash = $derived(this.all.filter((account) => account.kind === 'cash'));
	readonly credit = $derived(this.all.filter((account) => account.kind === 'creditCard'));
	readonly loaded = $derived.by(() => this.#query.data !== undefined);
	/** The sidebar's sections, leaving out an empty one. */
	readonly groups = $derived(
		[
			{ label: 'Cash', accounts: this.cash },
			{ label: 'Credit', accounts: this.credit }
		].filter((group) => group.accounts.length > 0)
	);

	/** `enabled` turns the subscription on once the owner is signed in. */
	constructor(enabled: () => boolean) {
		this.#query = useQuery(api.accounts.list, () => (enabled() ? {} : 'skip'));
	}

	find(accountId: string): Account | undefined {
		return this.all.find((account) => account._id === accountId);
	}

	/** Swaps an Account with its neighbor in the same group (Cash or Credit). */
	async move(accountId: Id<'accounts'>, direction: -1 | 1) {
		const order = this.all.slice();
		const from = order.findIndex((account) => account._id === accountId);
		const moving = order[from];
		if (!moving) return;
		let to = from + direction;
		let neighbor = order[to];
		while (neighbor && neighbor.kind !== moving.kind) neighbor = order[(to += direction)];
		if (!neighbor) return;
		order[from] = neighbor;
		order[to] = moving;
		await this.#reorder({ accountIds: order.map((account) => account._id) });
	}

	/** Whether `move` can go that way within the Account's group. */
	canMove(accountId: string, direction: -1 | 1): boolean {
		const account = this.find(accountId);
		if (!account) return false;
		const group = account.kind === 'cash' ? this.cash : this.credit;
		const index = group.indexOf(account);
		return group[index + direction] !== undefined;
	}
}

export const [getAccounts, setAccounts] = createContext<Accounts>();
