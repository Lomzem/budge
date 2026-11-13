<script lang="ts">
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { useQuery } from 'convex-svelte';
	import { tick, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import {
		getBankConnections,
		type BankConnection,
		type HeldAccount
	} from '$lib/bankConnections.svelte';
	import ConnectionCard from '$lib/components/bank/connection-card.svelte';
	import HeldAccountDialog from '$lib/components/bank/held-account-dialog.svelte';
	import CutoverDate from '$lib/components/settings/cutover-date.svelte';
	import { Button } from '$lib/components/ui/button';

	const bank = getBankConnections();
	const settings = useQuery(api.settings.get, {});
	const outcomes = new SvelteMap<Id<'connectionAccounts'>, string>();
	let heldDialog: { open: (account: HeldAccount) => void } | undefined = $state();
	let result = $state('');
	let connectButton: HTMLButtonElement | null = $state(null);
	let order: Id<'bankConnections'>[] = $state([]);
	let cutoverUnsetOnArrival = $state(false);

	$effect(() => {
		if (settings.data?.cutoverDate === null) cutoverUnsetOnArrival = true;
	});

	const ready = $derived(bank.loaded && settings.data !== undefined);
	const blocker = $derived.by(() => {
		if (bank.service?.available === false) return 'unavailable';
		if (settings.data?.cutoverDate === null) return 'cutover';
		return null;
	});
	const connecting = $derived(bank.linking === 'connecting');
	const connectBlocked = $derived(bank.linking !== null);

	function urgency(connection: BankConnection) {
		if (connection.status === 'needsAttention' || connection.lastError !== null) return 0;
		if (connection.consentEndsAt !== null || connection.overdue) return 1;
		if (bank.heldFrom(connection._id).length > 0) return 2;
		if (!connection.bankLogin) return 3;
		return 4;
	}

	$effect(() => {
		if (!bank.loaded) return;
		const known = untrack(() => order);
		const arrived = bank.all
			.filter((connection) => !known.includes(connection._id))
			.sort((a, b) => urgency(a) - urgency(b))
			.map((connection) => connection._id);
		if (arrived.length > 0) order.push(...arrived);
	});

	const connections = $derived(
		bank.all.toSorted((a, b) => order.indexOf(a._id) - order.indexOf(b._id))
	);

	let shownHash = '';
	$effect(() => {
		const { hash } = page.url;
		if (!ready || connections.length === 0 || hash === shownHash) return;
		shownHash = hash;
		if (hash === '') return;
		void tick().then(() => {
			const card = document.getElementById(hash.slice(1))?.closest('article');
			card?.scrollIntoView({ block: 'start' });
			card?.focus({ preventScroll: true });
		});
	});

	async function removed(connectionId: Id<'bankConnections'>, report: string) {
		const at = connections.findIndex((connection) => connection._id === connectionId);
		const next = connections[at + 1] ?? connections[at - 1];
		result = report;
		await tick();
		const card =
			next === undefined
				? null
				: document.getElementById(`connection-${next._id}`)?.closest('article');
		if (card) card.focus();
		else connectButton?.focus();
	}

	async function connect() {
		if (!ready || blocker !== null || connectBlocked) return;
		result = '';
		result = (await bank.connect()) ?? '';
	}
</script>

<svelte:head>
	<title>Bank · Budge</title>
</svelte:head>

<div class="flex max-w-4xl flex-col gap-6">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<div class="flex max-w-prose flex-col gap-1">
			<h1 class="text-2xl font-bold tracking-tight">Bank</h1>
			<p class="text-muted-foreground">
				New transactions arrive Unapproved as they post, ready to review on each Account. They count
				in your budget right away, and Budge checks each bank daily.
			</p>
		</div>
		<div class="grid min-w-44">
			<Button
				bind:ref={connectButton}
				aria-disabled={!ready || blocker !== null || connectBlocked}
				aria-describedby={blocker === null ? undefined : 'bank-blocker'}
				onclick={connect}
			>
				<PlusIcon aria-hidden="true" />
				{connecting ? 'Connecting…' : 'Connect a bank'}
			</Button>
		</div>
	</header>

	{#if bank.failed}
		<p role="alert" class="text-destructive">
			Budge couldn't load your banks. Try reloading the page.
		</p>
	{:else if !ready}
		<p role="status" class="text-muted-foreground">Loading…</p>
	{:else}
		{#if blocker === 'unavailable'}
			<p id="bank-blocker" class="rounded-lg bg-warning-tint p-4">
				Bank sync isn't set up on this server: it needs Plaid credentials. You can still import a
				bank file from an Account's page.
			</p>
		{:else if blocker === 'cutover'}
			<p id="bank-blocker" class="rounded-lg bg-warning-tint p-4">
				Set the cutover date below before connecting a bank, so Budge knows which transactions to
				bring in.
			</p>
		{:else if bank.service?.environment === 'sandbox'}
			<p class="rounded-lg bg-muted p-4">
				This server uses Plaid's sandbox, so no real bank is involved. In Plaid Link, pick any bank
				and sign in as <kbd class="font-bold">user_good</kbd> with password
				<kbd class="font-bold">pass_good</kbd>.
			</p>
		{/if}

		{#if cutoverUnsetOnArrival}
			<div class="max-w-2xl rounded-lg border bg-card p-5 sm:p-6">
				<CutoverDate />
			</div>
		{/if}

		<section aria-labelledby="connections-heading" class="flex flex-col gap-3">
			<h2 id="connections-heading" class="text-lg font-bold">Connections</h2>
			{#if bank.all.length === 0}
				<div
					class="flex flex-col items-start gap-2 rounded-lg border border-dashed border-input p-6"
				>
					<LandmarkIcon aria-hidden="true" class="size-6 text-muted-foreground" />
					<p class="font-bold">No banks connected yet</p>
					<p class="max-w-prose text-muted-foreground">
						Connect a bank to bring in its transactions automatically. Without one, import a bank
						file from an Account's page.
					</p>
				</div>
			{:else}
				<ul aria-label="Bank Connections" class="flex flex-col gap-4">
					{#each connections as connection (connection._id)}
						<li>
							<ConnectionCard
								{connection}
								{outcomes}
								onsetup={(account: HeldAccount) => {
									heldDialog?.open(account);
								}}
								onremoved={(connectionId: Id<'bankConnections'>, report: string) => {
									void removed(connectionId, report);
								}}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<div
	class={result === ''
		? 'sr-only'
		: 'fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-md border bg-popover py-2 pr-2 pl-4 text-sm shadow-lg lg:bottom-6'}
>
	<p role="status" class="min-w-0 flex-1">{result}</p>
	{#if result !== ''}
		<Button
			variant="ghost"
			size="sm"
			onclick={() => {
				result = '';
				connectButton?.focus();
			}}
		>
			Dismiss
		</Button>
	{/if}
</div>

<HeldAccountDialog
	bind:this={heldDialog}
	onsettled={(connectionAccountId: Id<'connectionAccounts'>, outcome: string) => {
		outcomes.set(connectionAccountId, outcome);
	}}
/>
