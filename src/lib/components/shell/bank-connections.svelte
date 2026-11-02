<script lang="ts">
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient, useQuery } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getAccounts } from '$lib/accounts.svelte';
	import { attempt } from '$lib/attempt';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { formatSynced } from '$lib/domain/freshness';

	type SyncOutcome = FunctionReturnType<typeof api.bankConnections.syncNow>;

	const client = useConvexClient();
	const accounts = getAccounts();

	const connections = useQuery(api.bankConnections.list, () => (accounts.loaded ? {} : 'skip'));

	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 60_000);
		return () => {
			clearInterval(timer);
		};
	});

	let openId = $state<Id<'bankConnections'> | null>(null);
	const opened = $derived(connections.data?.find((connection) => connection._id === openId));
	let syncing = $state(false);
	let result = $state('');

	const exactTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

	function open(connectionId: Id<'bankConnections'>) {
		openId = connectionId;
		now = Date.now();
		result = '';
	}

	function describeSync(outcome: SyncOutcome): string {
		if (outcome.kind === 'busy') return 'A sync is already running.';
		if (outcome.kind === 'noToken') {
			return 'This Bank Connection has no bank login, so it never syncs.';
		}
		return `Added ${String(outcome.added)}, Matched ${String(outcome.matched)}.`;
	}

	async function syncNow(connectionId: Id<'bankConnections'>) {
		syncing = true;
		result = '';
		const synced = await attempt(() =>
			client.action(api.bankConnections.syncNow, { connectionId })
		);
		syncing = false;
		now = Date.now();
		result = synced.ok
			? describeSync(synced.value)
			: (synced.error?.message ?? "Budge couldn't sync. Try again.");
	}
</script>

{#if connections.data !== undefined && connections.data.length > 0}
	<ul aria-label="Bank Connections" class="flex flex-col gap-0.5 text-xs text-muted-foreground">
		{#each connections.data as connection (connection._id)}
			<li>
				<button
					class="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
					onclick={() => {
						open(connection._id);
					}}
				>
					{#if connection.status === 'needsAttention' || connection.lastError !== null}
						<TriangleAlertIcon aria-label="Last sync failed" class="size-3.5 shrink-0" />
					{/if}
					<span class="truncate">
						{connection.name}: {formatSynced(connection.lastSyncedAt, now)}
					</span>
				</button>
			</li>
		{/each}
	</ul>
{/if}

<Dialog.Root
	open={opened !== undefined}
	onOpenChange={(isOpen) => {
		if (!isOpen) openId = null;
	}}
>
	<Dialog.Content>
		{#if opened !== undefined}
			<Dialog.Header>
				<Dialog.Title>{opened.name}</Dialog.Title>
				<Dialog.Description>
					{#if opened.lastSyncedAt === null}
						Never synced.
					{:else}
						Last synced {exactTime.format(opened.lastSyncedAt)}.
					{/if}
				</Dialog.Description>
			</Dialog.Header>
			{#if opened.lastError !== null}
				<p role="alert" class="text-sm text-destructive">
					The sync at {exactTime.format(opened.lastError.at)} failed: {opened.lastError.message}
				</p>
			{/if}
			{#if result}
				<p role="status" class="text-sm">{result}</p>
			{/if}
			<Dialog.Footer>
				<Button disabled={syncing} onclick={() => syncNow(opened._id)}>
					<RefreshCwIcon aria-hidden="true" class={syncing ? 'animate-spin' : ''} />
					{syncing ? 'Syncing…' : 'Sync now'}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
