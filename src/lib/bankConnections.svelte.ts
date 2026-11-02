import type { FunctionReturnType } from 'convex/server';
import { useConvexClient, useQuery, type UseQueryReturn } from 'convex-svelte';
import { createContext } from 'svelte';

import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { openPlaidLink } from '$lib/plaidLink';
import { readPublicError } from '$lib/publicError';

export type BankConnection = FunctionReturnType<typeof api.bankConnections.list>[number];

const MINUTE = 60_000;

/**
 * The owner's Bank Connections and their sync health, live, and Reconnect. Construct once, in the
 * app layout, and share by context, so the sidebar and the budget screen's notice agree.
 */
export class BankConnections {
	/** The time health is judged at, to the minute; ticks while the page is open. */
	now = $state(Date.now());
	readonly #client = useConvexClient();
	readonly #query: UseQueryReturn<typeof api.bankConnections.list>;
	readonly all: BankConnection[] = $derived.by(() => this.#query.data ?? []);
	readonly needingAttention = $derived(
		this.all.filter((connection) => connection.status === 'needsAttention')
	);
	/** The Bank Connection Reconnect is running for, if any. */
	reconnecting = $state<Id<'bankConnections'> | null>(null);

	/** `enabled` turns the subscription on once the owner's Accounts load. */
	constructor(enabled: () => boolean) {
		this.#query = useQuery(
			api.bankConnections.list,
			() => (enabled() ? { now: Math.floor(this.now / MINUTE) * MINUTE } : 'skip'),
			{ keepPreviousData: true }
		);
		$effect(() => {
			const timer = setInterval(() => {
				this.tick();
			}, MINUTE);
			return () => {
				clearInterval(timer);
			};
		});
	}

	tick() {
		this.now = Date.now();
	}

	/**
	 * Reconnect: opens Plaid Link in update mode on the existing Item, then syncs once the owner
	 * finishes. Resolves to a line for the owner, or `null` if they closed Link.
	 */
	async reconnect(connectionId: Id<'bankConnections'>): Promise<string | null> {
		this.reconnecting = connectionId;
		try {
			const { linkToken } = await this.#client.action(api.bankConnections.reconnect, {
				connectionId
			});
			if ((await openPlaidLink(linkToken)) === 'exit') return null;
			const outcome = await this.#client.action(api.bankConnections.syncAfterReconnect, {
				connectionId
			});
			return outcome.kind === 'synced'
				? `Reconnected. Added ${String(outcome.added)}, Matched ${String(outcome.matched)}.`
				: 'Reconnected.';
		} catch (thrown) {
			return readPublicError(thrown)?.message ?? "Budge couldn't reconnect. Try again.";
		} finally {
			this.reconnecting = null;
			this.tick();
		}
	}
}

export const [getBankConnections, setBankConnections] = createContext<BankConnections>();
