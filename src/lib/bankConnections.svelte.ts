import type { FunctionReturnType } from 'convex/server';
import { useConvexClient, useQuery, type UseQueryReturn } from 'convex-svelte';
import { createContext } from 'svelte';

import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { openPlaidLink } from '$lib/plaidLink';
import { attempt } from '$lib/attempt';

export type BankConnection = FunctionReturnType<typeof api.bankConnections.list>[number];

const MINUTE = 60_000;

export class BankConnections {
	now = $state(Date.now());
	readonly #client = useConvexClient();
	readonly #query: UseQueryReturn<typeof api.bankConnections.list>;
	readonly all: BankConnection[] = $derived.by(() => this.#query.data ?? []);
	readonly needingAttention = $derived(
		this.all.filter((connection) => connection.status === 'needsAttention')
	);
	reconnecting = $state<Id<'bankConnections'> | null>(null);

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

	async reconnect(connectionId: Id<'bankConnections'>): Promise<string | null> {
		this.reconnecting = connectionId;
		const reconnected = await attempt(async () => {
			const { linkToken } = await this.#client.action(api.bankConnections.reconnect, {
				connectionId
			});
			const linked = await openPlaidLink(linkToken);
			if (linked !== 'success') return linked;
			return await this.#client.action(api.bankConnections.syncAfterReconnect, { connectionId });
		});
		this.reconnecting = null;
		this.tick();
		if (!reconnected.ok) {
			return reconnected.error?.message ?? "Budge couldn't reconnect. Try again.";
		}
		const outcome = reconnected.value;
		if (outcome === 'exit') return null;
		if (outcome === 'unavailable') return "Plaid Link didn't load. Try again.";
		return outcome.kind === 'synced'
			? `Reconnected. Added ${String(outcome.added)}, Matched ${String(outcome.matched)}.`
			: 'Reconnected.';
	}
}

export const [getBankConnections, setBankConnections] = createContext<BankConnections>();
