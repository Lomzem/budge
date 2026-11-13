import type { FunctionReturnType } from 'convex/server';
import { useConvexClient, useQuery, type UseQueryReturn } from 'convex-svelte';
import { createContext } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { attempt } from '$lib/attempt';
import { openPlaidLink } from '$lib/plaidLink';

export type BankConnection = FunctionReturnType<typeof api.bankConnections.list>[number];
export type HeldAccount = FunctionReturnType<typeof api.heldAccounts.list>[number];
export type SyncOutcome = FunctionReturnType<typeof api.bankConnections.syncNow>;

const MINUTE = 60_000;

export function needsALook(connection: BankConnection) {
	return (
		connection.status === 'needsAttention' ||
		connection.lastError !== null ||
		connection.overdue ||
		connection.consentEndsAt !== null
	);
}

const shortDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

export function attentionOf(connection: BankConnection): string | null {
	if (connection.status === 'needsAttention') return 'Reconnect needed';
	if (connection.lastError !== null) return 'Last sync failed';
	if (connection.consentEndsAt !== null) {
		return `Consent ends ${shortDay.format(connection.consentEndsAt)}`;
	}
	if (connection.overdue) return 'Missed its daily sync';
	return null;
}

export interface Report {
	text: string;
	failed: boolean;
}

export function describeSync(outcome: SyncOutcome): Report {
	if (outcome.kind === 'busy') return { text: 'A sync is already running.', failed: false };
	if (outcome.kind === 'noToken') {
		return { text: 'This Bank Connection has no bank login, so it never syncs.', failed: true };
	}
	return {
		text: `Synced. Added ${String(outcome.added)}, Matched ${String(outcome.matched)}.`,
		failed: false
	};
}

export function describeReconnect(outcome: SyncOutcome): Report {
	if (outcome.kind === 'synced') {
		return {
			text: `Reconnected. Added ${String(outcome.added)}, Matched ${String(outcome.matched)}.`,
			failed: false
		};
	}
	const synced = describeSync(outcome);
	return { text: `Reconnected. ${synced.text}`, failed: synced.failed };
}

export class BankConnections {
	now = $state(Date.now());
	readonly #client = useConvexClient();
	readonly #list: UseQueryReturn<typeof api.bankConnections.list>;
	readonly #held: UseQueryReturn<typeof api.heldAccounts.list>;
	readonly #service: UseQueryReturn<typeof api.bankConnections.service>;
	readonly all: BankConnection[] = $derived.by(() => this.#list.data ?? []);
	readonly held: HeldAccount[] = $derived.by(() => this.#held.data ?? []);
	readonly service = $derived.by(() => this.#service.data);
	readonly loaded = $derived.by(
		() =>
			this.#list.data !== undefined && this.#held.data !== undefined && this.service !== undefined
	);
	readonly failed = $derived.by(
		() =>
			this.#list.error !== undefined ||
			this.#held.error !== undefined ||
			this.#service.error !== undefined
	);
	readonly needingAttention = $derived(
		this.all.filter((connection) => connection.status === 'needsAttention')
	);
	readonly needingYou = $derived(
		this.held.length +
			this.all.filter(needsALook).length +
			this.all
				.flatMap((connection) => connection.feeds)
				.filter((feed) => !feed.startingBalanceConfirmed).length
	);
	readonly broken = $derived(
		this.all.some(
			(connection) => connection.status === 'needsAttention' || connection.lastError !== null
		)
	);
	linking = $state<Id<'bankConnections'> | 'connecting' | null>(null);
	readonly syncing = new SvelteSet<Id<'bankConnections'>>();

	constructor(enabled: () => boolean) {
		this.#list = useQuery(
			api.bankConnections.list,
			() => (enabled() ? { now: Math.floor(this.now / MINUTE) * MINUTE } : 'skip'),
			{ keepPreviousData: true }
		);
		this.#held = useQuery(api.heldAccounts.list, () => (enabled() ? {} : 'skip'));
		this.#service = useQuery(api.bankConnections.service, () => (enabled() ? {} : 'skip'));
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

	heldFrom(connectionId: Id<'bankConnections'>) {
		return this.held.filter((account) => account.connectionId === connectionId);
	}

	async connect(): Promise<string | null> {
		this.linking = 'connecting';
		const connected = await attempt(async () => {
			const { linkToken } = await this.#client.action(api.bankConnections.connect, {});
			const linked = await openPlaidLink(linkToken);
			if (linked === 'exit' || linked === 'unavailable') return linked;
			await this.#client.action(api.bankConnections.finishConnect, {
				publicToken: linked.publicToken,
				...(linked.institutionName === undefined ? {} : { institutionName: linked.institutionName })
			});
			return linked.institutionName ?? 'your bank';
		});
		this.linking = null;
		this.tick();
		if (!connected.ok) {
			return connected.error?.message ?? "Budge couldn't connect the bank. Try again.";
		}
		if (connected.value === 'exit') return null;
		if (connected.value === 'unavailable') return "Plaid Link didn't load. Try again.";
		return `Connected ${connected.value}. Choose where each bank Account's rows go.`;
	}

	async reconnect(connectionId: Id<'bankConnections'>): Promise<Report | null> {
		this.linking = connectionId;
		const reconnected = await attempt(async () => {
			const { linkToken } = await this.#client.action(api.bankConnections.reconnect, {
				connectionId
			});
			const linked = await openPlaidLink(linkToken);
			if (linked === 'exit' || linked === 'unavailable') return linked;
			return await this.#client.action(api.bankConnections.syncAfterReconnect, { connectionId });
		});
		this.linking = null;
		this.tick();
		if (!reconnected.ok) {
			return {
				text: reconnected.error?.message ?? "Budge couldn't reconnect. Try again.",
				failed: true
			};
		}
		const outcome = reconnected.value;
		if (outcome === 'exit') return null;
		if (outcome === 'unavailable')
			return { text: "Plaid Link didn't load. Try again.", failed: true };
		return describeReconnect(outcome);
	}

	async remove(connectionId: Id<'bankConnections'>): Promise<Report> {
		const removed = await attempt(() =>
			this.#client.action(api.bankConnections.remove, { connectionId })
		);
		return removed.ok
			? { text: 'Removed. Its Transactions stay in your Accounts.', failed: false }
			: {
					text: removed.error?.message ?? "Budge couldn't remove the connection. Try again.",
					failed: true
				};
	}

	async stopSyncing(connectionAccountId: Id<'connectionAccounts'>, name: string): Promise<Report> {
		const stopped = await attempt(() =>
			this.#client.mutation(api.heldAccounts.stopSyncing, { connectionAccountId })
		);
		return stopped.ok
			? { text: `Stopped syncing ${name}. Its Transactions stay.`, failed: false }
			: {
					text: stopped.error?.message ?? "Budge couldn't stop syncing. Try again.",
					failed: true
				};
	}

	async restore(connectionAccountId: Id<'connectionAccounts'>): Promise<Report> {
		const restored = await attempt(() =>
			this.#client.mutation(api.heldAccounts.restore, { connectionAccountId })
		);
		return restored.ok
			? { text: 'Brought back. Set it up to choose where its rows go.', failed: false }
			: {
					text: restored.error?.message ?? "Budge couldn't bring it back. Try again.",
					failed: true
				};
	}

	async sync(connectionId: Id<'bankConnections'>): Promise<Report> {
		this.syncing.add(connectionId);
		const synced = await attempt(() =>
			this.#client.action(api.bankConnections.syncNow, { connectionId })
		);
		this.syncing.delete(connectionId);
		this.tick();
		return synced.ok
			? describeSync(synced.value)
			: { text: synced.error?.message ?? "Budge couldn't sync. Try again.", failed: true };
	}
}

export const [getBankConnections, setBankConnections] = createContext<BankConnections>();
