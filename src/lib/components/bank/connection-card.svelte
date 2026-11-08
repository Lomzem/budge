<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import { untrack } from 'svelte';

	import { resolve } from '$app/paths';
	import type { Id } from '$convex/_generated/dataModel';
	import {
		getBankConnections,
		type BankConnection,
		type HeldAccount
	} from '$lib/bankConnections.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatSynced } from '$lib/domain/freshness';

	import { labelOf, rowsOf } from './held';

	let {
		connection,
		outcomes,
		onsetup
	}: {
		connection: BankConnection;
		outcomes: ReadonlyMap<Id<'connectionAccounts'>, string>;
		onsetup: (account: HeldAccount) => void;
	} = $props();

	const bank = getBankConnections();
	const syncing = $derived(bank.syncing.has(connection._id));
	const reconnecting = $derived(bank.linking === connection._id);
	let result = $state('');

	const exactTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	const day = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

	const health = $derived.by((): { tone: 'ok' | 'warn' | 'bad'; text: string } => {
		if (connection.status === 'needsAttention') {
			return { tone: 'bad', text: 'Needs you to reconnect before it can sync again.' };
		}
		if (connection.lastError !== null) {
			return {
				tone: 'bad',
				text: `The sync at ${exactTime.format(connection.lastError.at)} failed: ${connection.lastError.message}`
			};
		}
		if (connection.consentEndsAt !== null) {
			return {
				tone: 'warn',
				text: `Your consent at the bank ends ${day.format(connection.consentEndsAt)}. Reconnect to renew it.`
			};
		}
		if (connection.overdue && connection.lastSyncedAt !== null) {
			return { tone: 'warn', text: `Not synced since ${day.format(connection.lastSyncedAt)}.` };
		}
		return { tone: 'ok', text: `${formatSynced(connection.lastSyncedAt, bank.now)}.` };
	});
	const message = $derived.by(() => {
		if (syncing) return 'Syncing…';
		if (reconnecting) return 'Reconnecting…';
		return result;
	});
	const serverCanSync = $derived(bank.service?.available !== false);
	const reconnectFirst = $derived(
		connection.status === 'needsAttention' || connection.consentEndsAt !== null
	);

	interface Seen {
		_id: Id<'connectionAccounts'>;
		label: string;
		name: string;
		mask: string | null;
		waiting: string;
	}
	interface Row extends Seen {
		held: HeldAccount | null;
		outcome: string | null;
	}
	let seen: Seen[] = $state([]);
	const held = $derived(bank.heldFrom(connection._id));

	$effect(() => {
		const known = untrack(() => seen);
		for (const account of held) {
			const label = labelOf(account);
			const waiting = rowsOf(account);
			const row = {
				_id: account._id,
				label,
				name: account.name ?? 'An unnamed bank Account',
				mask: account.mask,
				waiting
			};
			const index = known.findIndex((candidate) => candidate._id === account._id);
			if (index === -1) seen.push(row);
			else if (known[index]?.label !== label || known[index].waiting !== waiting) {
				seen[index] = row;
			}
		}
	});

	const rows: Row[] = $derived(
		seen.flatMap((row) => {
			const account = held.find((candidate) => candidate._id === row._id) ?? null;
			const outcome = outcomes.get(row._id) ?? null;
			if (account === null && outcome === null) return [];
			return [{ ...row, held: account, outcome }];
		})
	);

	async function sync() {
		result = '';
		result = await bank.sync(connection._id);
	}

	async function reconnect() {
		result = '';
		result = (await bank.reconnect(connection._id)) ?? '';
	}
</script>

<article aria-labelledby="connection-{connection._id}" class="rounded-lg border bg-card">
	<div class="flex flex-wrap items-start gap-x-4 gap-y-3 p-4 sm:p-5">
		<div class="flex min-w-0 flex-1 basis-64 items-start gap-3">
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
			>
				<LandmarkIcon aria-hidden="true" class="size-5" />
			</span>
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<h3 id="connection-{connection._id}" class="text-lg font-bold break-words">
					{connection.name}
				</h3>
				<p class="text-sm break-words text-muted-foreground">
					{#if connection.feeds.length === 0}
						Feeds no Budge Account yet.
					{:else}
						Feeds
						{#each connection.feeds as feed, index (feed.accountId)}
							<a
								href={resolve('/(app)/accounts/[accountId]', { accountId: feed.accountId })}
								class="font-medium text-foreground underline underline-offset-4 hover:no-underline"
								>{feed.name}</a
							>{index < connection.feeds.length - 1 ? ', ' : '.'}
						{/each}
					{/if}
				</p>
				<p
					class={[
						'flex items-start gap-1.5 text-sm break-words',
						health.tone === 'bad' && 'text-destructive',
						health.tone === 'warn' && 'text-warning',
						health.tone === 'ok' && 'text-muted-foreground'
					]}
				>
					{#if health.tone === 'ok'}
						<CircleCheckIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0 text-funded" />
					{:else}
						<CircleAlertIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
					{/if}
					<span class="min-w-0">{health.text}</span>
				</p>
				<p class="flex min-h-5 items-start gap-1.5 text-sm break-words text-muted-foreground">
					{#if message !== ''}
						<ClockIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
						<span class="min-w-0">{message}</span>
					{:else if !serverCanSync}
						<span class="min-w-0">Bank sync isn't set up on this server, so this can't sync.</span>
					{/if}
				</p>
				<span role="status" class="sr-only">{result}</span>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-2 sm:flex">
			<div class="grid sm:min-w-32">
				<Button
					variant={reconnectFirst ? 'default' : 'outline'}
					disabled={bank.linking !== null || syncing}
					onclick={reconnect}
				>
					{reconnecting ? 'Reconnecting…' : 'Reconnect'}
				</Button>
			</div>
			<div class="grid sm:min-w-32">
				<Button
					variant={reconnectFirst ? 'outline' : 'default'}
					disabled={syncing || reconnecting}
					onclick={sync}
				>
					<RefreshCwIcon aria-hidden="true" class={syncing ? 'animate-spin' : ''} />
					{syncing ? 'Syncing…' : 'Sync now'}
				</Button>
			</div>
		</div>
	</div>
	{#if rows.length > 0}
		<section
			aria-labelledby="held-{connection._id}"
			class="flex flex-col gap-1 border-t px-4 pt-3 pb-4 sm:px-5"
		>
			<h4 id="held-{connection._id}" class="font-bold">New bank Accounts</h4>
			<p class="pb-1 text-sm text-muted-foreground">
				Budge holds their rows until you choose where each one goes.
			</p>
			<ul class="flex flex-col divide-y">
				{#each rows as row (row._id)}
					<li class="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
						<div class="flex min-w-0 flex-1 basis-48 flex-col">
							<span class="font-bold break-words">{row.name}</span>
							{#if row.mask !== null}
								<span class="text-sm text-muted-foreground">Ending {row.mask}</span>
							{/if}
							<span class="text-sm text-muted-foreground">
								{row.outcome ?? row.waiting}
							</span>
						</div>
						{#if row.held !== null && row.outcome === null}
							{@const account = row.held}
							<div class="grid min-w-24">
								<Button
									variant="outline"
									aria-label="Set up {row.label}"
									onclick={() => {
										onsetup(account);
									}}
								>
									Set up
								</Button>
							</div>
						{:else}
							<span class="flex h-9 items-center gap-1.5 text-sm text-funded">
								<CircleCheckIcon aria-hidden="true" class="size-4" />
								Done
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</article>
