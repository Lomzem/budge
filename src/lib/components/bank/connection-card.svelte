<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import { untrack } from 'svelte';

	import { resolve } from '$app/paths';
	import type { Id } from '$convex/_generated/dataModel';
	import {
		getBankConnections,
		type BankConnection,
		type HeldAccount,
		type Report
	} from '$lib/bankConnections.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatAgo } from '$lib/domain/freshness';

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
	let result: Report | null = $state(null);

	const withoutCode = (message: string) => message.replace(/ \([A-Z_]+\)(?=\.?$)/, '');

	const exactTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	const day = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

	const problems = $derived.by((): { tone: 'warn' | 'bad'; text: string }[] => {
		if (!connection.bankLogin) {
			return [
				{
					tone: 'warn',
					text: 'A sample connection with no bank login, so it can’t sync or reconnect.'
				}
			];
		}
		const found: { tone: 'warn' | 'bad'; text: string }[] = [];
		const failedAt =
			connection.lastError === null ? null : exactTime.format(connection.lastError.at);
		if (connection.status === 'needsAttention') {
			found.push({
				tone: 'bad',
				text:
					failedAt === null
						? 'Needs you to reconnect before it can sync again.'
						: `Needs you to reconnect before it can sync again. The bank stopped its sync at ${failedAt}.`
			});
		} else if (connection.lastError !== null) {
			found.push({
				tone: 'bad',
				text: `The sync at ${String(failedAt)} failed: ${withoutCode(connection.lastError.message)}`
			});
		}
		if (connection.consentEndsAt !== null) {
			found.push({
				tone: 'warn',
				text: `Your consent at the bank ends ${day.format(connection.consentEndsAt)}. Reconnect to renew it.`
			});
		}
		if (connection.overdue) {
			found.push({ tone: 'warn', text: 'Has missed its daily sync. Try Sync now.' });
		}
		return found;
	});
	const synced = $derived(
		connection.lastSyncedAt === null
			? 'Never synced.'
			: `Last successful sync ${formatAgo(connection.lastSyncedAt, bank.now)}.`
	);
	const pending = $derived.by(() => {
		if (syncing) return 'Syncing…';
		if (reconnecting) return 'Reconnecting…';
		return null;
	});
	const reconnectBlocked = $derived(!connection.bankLogin || bank.linking !== null || syncing);
	const syncBlocked = $derived(!connection.bankLogin || syncing || reconnecting);
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
		if (syncBlocked) return;
		result = null;
		result = await bank.sync(connection._id);
	}

	async function reconnect() {
		if (reconnectBlocked) return;
		result = null;
		result = await bank.reconnect(connection._id);
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
				{#if problems.length > 0}
					<ul id="problems-{connection._id}" class="flex flex-col gap-1">
						{#each problems as problem (problem.text)}
							<li
								class={[
									'flex items-start gap-1.5 text-sm font-medium break-words',
									problem.tone === 'bad' ? 'text-destructive' : 'text-warning'
								]}
							>
								<CircleAlertIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
								<span class="min-w-0">{problem.text}</span>
							</li>
						{/each}
					</ul>
				{/if}
				<p class="flex items-start gap-1.5 text-sm break-words text-muted-foreground">
					{#if problems.length === 0}
						<CircleCheckIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0 text-funded" />
					{:else}
						<ClockIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
					{/if}
					<span class="min-w-0">{synced}</span>
				</p>
				<p
					class={[
						'flex min-h-5 items-start gap-1.5 text-sm break-words',
						pending === null && result?.failed ? 'text-destructive' : 'text-muted-foreground'
					]}
				>
					{#if pending !== null}
						<RefreshCwIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0 animate-spin" />
						<span class="min-w-0">{pending}</span>
					{:else if result !== null}
						{#if result.failed}
							<TriangleAlertIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
						{:else}
							<CircleCheckIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0 text-funded" />
						{/if}
						<span class="min-w-0">{result.text}</span>
					{/if}
				</p>
				<span role="status" class="sr-only">{result?.text ?? ''}</span>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-2 sm:flex">
			<div class="grid sm:w-36">
				<Button
					variant={reconnectFirst && connection.bankLogin ? 'default' : 'outline'}
					aria-disabled={reconnectBlocked}
					aria-describedby={connection.bankLogin ? undefined : `problems-${connection._id}`}
					onclick={reconnect}
				>
					{reconnecting ? 'Reconnecting…' : 'Reconnect'}
				</Button>
			</div>
			<div class="grid sm:w-36">
				<Button
					variant={reconnectFirst || !connection.bankLogin ? 'outline' : 'default'}
					aria-disabled={syncBlocked}
					aria-describedby={connection.bankLogin ? undefined : `problems-${connection._id}`}
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
