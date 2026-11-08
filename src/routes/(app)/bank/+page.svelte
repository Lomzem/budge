<script lang="ts">
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { useQuery } from 'convex-svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import { resolve } from '$app/paths';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getBankConnections, type HeldAccount } from '$lib/bankConnections.svelte';
	import ConnectionCard from '$lib/components/bank/connection-card.svelte';
	import HeldAccountDialog from '$lib/components/bank/held-account-dialog.svelte';
	import { Button } from '$lib/components/ui/button';

	const bank = getBankConnections();
	const settings = useQuery(api.settings.get, {});
	const outcomes = new SvelteMap<Id<'connectionAccounts'>, string>();
	let heldDialog: { open: (account: HeldAccount) => void } | undefined = $state();
	let result = $state('');

	const ready = $derived(bank.loaded && settings.data !== undefined);
	const blocker = $derived.by(() => {
		if (bank.service?.available === false) return 'unavailable';
		if (settings.data?.cutoverDate === null) return 'cutover';
		return null;
	});
	const connecting = $derived(bank.linking === 'connecting');

	async function connect() {
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
				Connected banks send Budge their new transactions as they post, and Budge checks each one
				daily. New rows arrive Unapproved, so nothing lands in your budget unseen.
			</p>
		</div>
		<div class="grid min-w-44">
			<Button disabled={!ready || blocker !== null || bank.linking !== null} onclick={connect}>
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
			<p class="rounded-lg bg-warning-tint p-4">
				Bank sync isn't set up on this server: it needs Plaid credentials. You can still import a
				bank file from an Account's page.
			</p>
		{:else if blocker === 'cutover'}
			<p class="rounded-lg bg-warning-tint p-4">
				Set the cutover date in <a
					href={resolve('/settings')}
					class="font-bold underline underline-offset-4 hover:no-underline">Settings</a
				> before connecting a bank, so Budge knows which transactions to bring in.
			</p>
		{:else if bank.service?.environment === 'sandbox'}
			<p class="rounded-lg bg-muted p-4">
				This server uses Plaid's sandbox, so no real bank is involved. In Plaid Link, pick any bank
				and sign in as <kbd class="font-bold">user_good</kbd> with password
				<kbd class="font-bold">pass_good</kbd>.
			</p>
		{/if}
		<p role="status" class="-my-3 min-h-12 sm:min-h-6">{result}</p>

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
					{#each bank.all as connection (connection._id)}
						<li>
							<ConnectionCard
								{connection}
								{outcomes}
								onsetup={(account: HeldAccount) => {
									heldDialog?.open(account);
								}}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<HeldAccountDialog
	bind:this={heldDialog}
	onsettled={(connectionAccountId: Id<'connectionAccounts'>, outcome: string) => {
		outcomes.set(connectionAccountId, outcome);
	}}
/>
