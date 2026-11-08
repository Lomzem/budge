<script lang="ts">
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient } from 'convex-svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getBankConnections, type BankConnection } from '$lib/bankConnections.svelte';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { formatSynced } from '$lib/domain/freshness';

	type SyncOutcome = FunctionReturnType<typeof api.bankConnections.syncNow>;

	const client = useConvexClient();
	const connections = getBankConnections();

	const dialog = new DialogSession<
		{
			connectionId: Id<'bankConnections'>;
			result: string;
		},
		'sync'
	>();
	const syncing = $derived(dialog.pending('sync'));
	const opened = $derived(
		connections.all.find((connection) => connection._id === dialog.current?.connectionId)
	);

	const exactTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	const day = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

	function freshness(connection: BankConnection) {
		if (connection.overdue && connection.lastSyncedAt !== null) {
			return `Not synced since ${day.format(connection.lastSyncedAt)}`;
		}
		return formatSynced(connection.lastSyncedAt, connections.now);
	}

	const unseenReconnectResults = new SvelteMap<Id<'bankConnections'>, string>();

	function open(connectionId: Id<'bankConnections'>) {
		const result = unseenReconnectResults.get(connectionId) ?? '';
		unseenReconnectResults.delete(connectionId);
		dialog.open({ connectionId, result });
		connections.tick();
	}

	function describeSync(outcome: SyncOutcome): string {
		if (outcome.kind === 'busy') return 'A sync is already running.';
		if (outcome.kind === 'noToken') {
			return 'This Bank Connection has no bank login, so it never syncs.';
		}
		return `Added ${String(outcome.added)}, Matched ${String(outcome.matched)}.`;
	}

	async function syncNow() {
		const session = dialog.current;
		if (session === null) return;
		session.result = '';
		const synced = await dialog.run('sync', () =>
			client
				.action(api.bankConnections.syncNow, { connectionId: session.connectionId })
				.finally(() => {
					connections.tick();
				})
		);
		session.result = synced.ok
			? describeSync(synced.value)
			: (synced.error?.message ?? "Budge couldn't sync. Try again.");
	}

	async function reconnect(connectionId: Id<'bankConnections'>) {
		dialog.dismiss();
		const message = await connections.reconnect(connectionId);
		if (message === null) return;
		const showing = dialog.current;
		if (showing?.connectionId === connectionId) {
			showing.result = message;
			return;
		}
		unseenReconnectResults.set(connectionId, message);
		if (showing === null) open(connectionId);
	}
</script>

{#if connections.all.length > 0}
	<ul aria-label="Bank Connections" class="flex flex-col gap-0.5 text-xs text-muted-foreground">
		{#each connections.all as connection (connection._id)}
			<li>
				<button
					class="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
					onclick={() => {
						open(connection._id);
					}}
				>
					{#if connection.status === 'needsAttention' || connection.lastError !== null || connection.overdue}
						<TriangleAlertIcon aria-label="Needs a look" class="size-3.5 shrink-0" />
					{/if}
					<span class="truncate">
						{connection.name}: {freshness(connection)}
					</span>
				</button>
				{#if connection.consentEndsAt !== null}
					<p class="px-2">
						Consent ends {day.format(connection.consentEndsAt)},
						<button
							class="underline underline-offset-4 hover:no-underline focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none disabled:opacity-50"
							disabled={connections.reconnecting !== null}
							onclick={() => reconnect(connection._id)}>renew</button
						>
					</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<Dialog.Root
	open={opened !== undefined}
	onOpenChange={(isOpen) => {
		if (!isOpen) dialog.dismiss();
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
			{#if opened.status === 'needsAttention'}
				<p class="text-sm">{opened.name} needs you to reconnect.</p>
			{/if}
			{#if opened.consentEndsAt !== null}
				<p class="text-sm">
					Your consent at the bank ends {exactTime.format(opened.consentEndsAt)}. Reconnect to renew
					it.
				</p>
			{/if}
			{#if opened.lastError !== null}
				<p role="alert" class="text-sm text-destructive">
					The sync at {exactTime.format(opened.lastError.at)} failed: {opened.lastError.message}
				</p>
			{/if}
			{#if dialog.current?.result}
				<p role="status" class="text-sm">{dialog.current.result}</p>
			{/if}
			<Dialog.Footer>
				{#if opened.status === 'needsAttention' || opened.consentEndsAt !== null}
					<Button
						variant="outline"
						disabled={connections.reconnecting !== null || syncing}
						onclick={() => reconnect(opened._id)}
					>
						{connections.reconnecting === opened._id ? 'Reconnecting…' : 'Reconnect'}
					</Button>
				{/if}
				<Button disabled={syncing || connections.reconnecting !== null} onclick={syncNow}>
					<RefreshCwIcon aria-hidden="true" class={syncing ? 'animate-spin' : ''} />
					{syncing ? 'Syncing…' : 'Sync now'}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
