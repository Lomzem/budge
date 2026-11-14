<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import { tick, untrack } from 'svelte';

	import { resolve } from '$app/paths';
	import type { Id } from '$convex/_generated/dataModel';
	import {
		feedNeedsYou,
		getBankConnections,
		type BankConnection,
		type Feed,
		type HeldAccount,
		type Report
	} from '$lib/bankConnections.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { formatAgo } from '$lib/domain/freshness';

	import { labelOf, rowsOf } from './held';

	let {
		connection,
		outcomes,
		onsetup,
		oncheck,
		onremoved
	}: {
		connection: BankConnection;
		outcomes: ReadonlyMap<Id<'connectionAccounts'>, string>;
		onsetup: (account: HeldAccount) => void;
		oncheck: (accountId: Id<'accounts'>) => void;
		onremoved: (connectionId: Id<'bankConnections'>, report: string) => void;
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
	const feedsNeedYou = $derived(connection.feeds.some(feedNeedsYou));
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
	const aside = $derived.by(() => (result?.failed ? synced : result?.detail));
	const slotText = $derived.by(() => {
		if (pending !== null) return pending;
		if (result === null) return synced;
		return aside === undefined ? result.text : `${result.text} ${aside}`;
	});
	const reconnectBlocked = $derived(!connection.bankLogin || bank.linking !== null || syncing);
	const paused = $derived(connection.bankLogin && connection.status === 'needsAttention');
	const syncBlocked = $derived(!connection.bankLogin || paused || syncing || reconnecting);
	const syncReason = $derived(
		!connection.bankLogin || paused ? `problems-${connection._id}` : undefined
	);
	const reconnectFirst = $derived(
		connection.status === 'needsAttention' || connection.consentEndsAt !== null
	);
	const hinted = $derived(connection.bankLogin && !reconnectFirst);
	const reconnectReason = $derived.by(() => {
		if (!connection.bankLogin) return `problems-${connection._id}`;
		return hinted ? `reconnect-hint-${connection._id}` : undefined;
	});

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
	const nothingNeedsYou = $derived(problems.length === 0 && !feedsNeedYou && held.length === 0);

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
			const outcome = account === null ? (outcomes.get(row._id) ?? null) : null;
			if (account === null && outcome === null) return [];
			return [{ ...row, held: account, outcome }];
		})
	);

	let confirmRemove = $state(false);
	let removing = $state(false);
	let restoring = $state<Id<'connectionAccounts'> | null>(null);
	let menuButton: HTMLButtonElement | null = $state(null);

	async function stopSyncing(feed: Feed) {
		result = null;
		result = await bank.stopSyncing(feed);
	}

	async function restore(connectionAccountId: Id<'connectionAccounts'>) {
		if (restoring !== null) return;
		restoring = connectionAccountId;
		result = null;
		const report = await bank.restore(connectionAccountId);
		restoring = null;
		result = report;
		if (report.failed) return;
		await tick();
		document.querySelector<HTMLElement>(`[data-setup="${connectionAccountId}"]`)?.focus();
	}

	async function remove() {
		if (removing) return;
		removing = true;
		const report = await bank.remove(connection._id);
		removing = false;
		confirmRemove = false;
		if (report.failed) result = report;
		else onremoved(connection._id, `${connection.name}: ${report.text}`);
	}

	async function sync() {
		if (paused && !reconnecting) {
			result = { failed: true, text: 'Reconnect first. The bank paused syncing until you do.' };
			return;
		}
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

<article
	aria-labelledby="connection-{connection._id}"
	tabindex="-1"
	class="scroll-mt-4 rounded-lg border bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
>
	<div class="flex flex-col gap-3 p-4 sm:p-5">
		<div class="flex min-w-0 items-center gap-3">
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
			>
				<LandmarkIcon aria-hidden="true" class="size-5" />
			</span>
			<h3 id="connection-{connection._id}" class="min-w-0 flex-1 text-lg font-bold break-words">
				{connection.name}
			</h3>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button
							bind:ref={menuButton}
							variant="ghost"
							size="icon"
							aria-label="{connection.name} actions"
							{...props}
						>
							<EllipsisIcon aria-hidden="true" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					{#each connection.feeds as feed (feed.connectionAccountId)}
						<DropdownMenu.Item onSelect={() => void stopSyncing(feed)}>
							Stop syncing {labelOf({ name: feed.bankName, mask: feed.mask })}
						</DropdownMenu.Item>
					{/each}
					{#if connection.feeds.length > 0}
						<DropdownMenu.Separator />
					{/if}
					<DropdownMenu.Item variant="destructive" onSelect={() => (confirmRemove = true)}>
						Remove connection…
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
		<div class="flex flex-col gap-1 sm:pl-13">
			{#if connection.feeds.length === 0}
				<p class="text-sm break-words text-muted-foreground">
					Feeds no Budge Account yet.{paused && held.length === 0
						? ' Reconnect to see its accounts and choose where they go.'
						: ''}
				</p>
			{:else}
				<ul aria-label="Where {connection.name} goes" class="flex flex-col gap-2">
					{#each connection.feeds as feed (feed.connectionAccountId)}
						<li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
							<div class="flex min-w-0 flex-1 basis-48 flex-col text-sm">
								<span class="break-words text-muted-foreground">
									<a
										href={resolve('/(app)/accounts/[accountId]', { accountId: feed.accountId })}
										class="font-medium text-foreground underline underline-offset-4 hover:no-underline"
										>{feed.name}</a
									>
									from {labelOf({ name: feed.bankName, mask: feed.mask })}
								</span>
								{#if !feed.startingBalanceConfirmed}
									<span class="flex items-start gap-1.5 font-medium text-warning">
										<CircleAlertIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
										<span class="min-w-0">Starting balance not confirmed</span>
									</span>
								{/if}
								{#if feed.historyIn !== null}
									<span class="flex items-start gap-1.5 font-medium text-warning">
										<CircleAlertIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
										<span class="min-w-0 break-words">
											Its earlier Transactions are still in
											<a
												href={resolve('/(app)/accounts/[accountId]', {
													accountId: feed.historyIn.accountId
												})}
												class="underline underline-offset-4 hover:no-underline"
												>{feed.historyIn.name}</a
											>. Only new ones come to {feed.name}.
										</span>
									</span>
								{/if}
							</div>
							{#if !feed.startingBalanceConfirmed}
								<Button
									variant="outline"
									size="sm"
									aria-label="Check {feed.name}'s starting balance"
									onclick={() => {
										oncheck(feed.accountId);
									}}
								>
									Check balance
								</Button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
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
			{#if hinted}
				<p id="reconnect-hint-{connection._id}" class="text-sm break-words text-muted-foreground">
					Reconnect if the bank asks you to sign in again.
				</p>
			{/if}
		</div>
		<div
			class="flex flex-col gap-x-4 gap-y-3 sm:flex-row sm:items-start sm:justify-between sm:pl-13"
		>
			<div title={slotText} class="h-10 min-w-0 sm:h-12 sm:flex-1 sm:pt-2">
				<p
					class={[
						'flex min-w-0 items-start gap-1.5 text-sm break-words',
						pending === null && result?.failed ? 'text-destructive' : 'text-muted-foreground'
					]}
				>
					{#if pending !== null}
						<RefreshCwIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0 animate-spin" />
						<span class="line-clamp-2 min-w-0">{pending}</span>
					{:else if result !== null}
						{#if result.failed}
							<TriangleAlertIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
						{:else if nothingNeedsYou}
							<CircleCheckIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0 text-funded" />
						{:else}
							<ClockIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
						{/if}
						<span class="line-clamp-2 min-w-0"
							>{result.text}
							{#if aside !== undefined}<span class="text-muted-foreground">{aside}</span>{/if}</span
						>
					{:else}
						{#if nothingNeedsYou}
							<CircleCheckIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0 text-funded" />
						{:else}
							<ClockIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
						{/if}
						<span class="line-clamp-2 min-w-0">{synced}</span>
					{/if}
				</p>
			</div>
			<span role="status" class="sr-only"
				>{[result?.text, result?.detail].filter(Boolean).join(' ')}</span
			>
			<div class="grid grid-cols-2 gap-2 sm:flex">
				<div class="grid sm:w-36">
					<Button
						variant={reconnectFirst && connection.bankLogin ? 'default' : 'outline'}
						aria-disabled={reconnectBlocked}
						aria-describedby={reconnectReason}
						onclick={reconnect}
					>
						{reconnecting ? 'Reconnecting…' : 'Reconnect'}
					</Button>
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div
					class="grid sm:w-36"
					onclick={(event) => {
						if (event.target === event.currentTarget) void sync();
					}}
				>
					<Button
						variant={reconnectFirst || !connection.bankLogin ? 'outline' : 'default'}
						aria-disabled={syncBlocked}
						aria-describedby={syncReason}
						onclick={sync}
					>
						<RefreshCwIcon aria-hidden="true" class={syncing ? 'animate-spin' : ''} />
						{syncing ? 'Syncing…' : 'Sync now'}
					</Button>
				</div>
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
				Their transactions wait here until you choose where they go.
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
									data-setup={row._id}
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
	{#if connection.ignored.length > 0}
		<section
			aria-labelledby="ignored-{connection._id}"
			class="flex flex-col gap-1 border-t px-4 pt-3 pb-4 sm:px-5"
		>
			<h4 id="ignored-{connection._id}" class="font-bold">Ignored bank Accounts</h4>
			<p class="pb-1 text-sm text-muted-foreground">
				Budge skips their transactions. Bring one back and set it up to choose where its new
				transactions go, from the next sync. The ones it already brought in stay where they are.
			</p>
			<ul class="flex flex-col divide-y">
				{#each connection.ignored as ignored (ignored.connectionAccountId)}
					{@const name = ignored.name ?? 'An unnamed bank Account'}
					<li class="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
						<div class="flex min-w-0 flex-1 basis-48 flex-col">
							<span class="font-bold break-words">{name}</span>
							{#if ignored.mask !== null}
								<span class="text-sm text-muted-foreground">Ending {ignored.mask}</span>
							{/if}
						</div>
						<div class="grid min-w-32">
							<Button
								variant="outline"
								aria-label="Bring back {name}{ignored.mask === null
									? ''
									: ` ending ${ignored.mask}`}"
								aria-disabled={restoring !== null}
								onclick={() => void restore(ignored.connectionAccountId)}
							>
								{restoring === ignored.connectionAccountId ? 'Bringing back…' : 'Bring back'}
							</Button>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</article>

<AlertDialog.Root bind:open={confirmRemove}>
	<AlertDialog.Content
		onCloseAutoFocus={(event: Event) => {
			event.preventDefault();
			menuButton?.focus();
		}}
	>
		<AlertDialog.Header>
			<AlertDialog.Title>Remove {connection.name}?</AlertDialog.Title>
			<AlertDialog.Description>
				Budge stops syncing it and forgets its bank Accounts and any transactions waiting for setup.
				Transactions it already brought in stay in your Accounts. To sync this bank again, connect
				it again.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep it</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" disabled={removing} onclick={remove}>
				{removing ? 'Removing…' : 'Remove connection'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
