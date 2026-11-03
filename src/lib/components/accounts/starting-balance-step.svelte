<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { onMount } from 'svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { attempt } from '$lib/attempt';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { parseCents } from '$lib/domain/money';

	let {
		account,
		skippable = false,
		onDone
	}: {
		account: { _id: Id<'accounts'>; kind: 'cash' | 'creditCard'; name: string };
		skippable?: boolean;
		onDone: () => void;
	} = $props();

	const client = useConvexClient();
	const owed = $derived(account.kind === 'creditCard');

	let balance = $state('');
	let suggesting = $state(false);
	let synced = $state(true);
	let suggestion = $state('');
	let error = $state('');
	let saving = $state(false);

	onMount(() => {
		void suggest();
	});

	function typed(cents: number) {
		return `${cents < 0 ? '-' : ''}${(Math.abs(cents) / 100).toFixed(2)}`;
	}

	function shown(startingBalance: number) {
		return owed ? -startingBalance : startingBalance;
	}

	async function suggest() {
		const accountId = account._id;
		const typedBefore = balance;
		suggesting = true;
		suggestion = '';
		const asked = await attempt(() =>
			client.action(api.heldAccounts.suggestStartingBalance, { accountId })
		);
		suggesting = false;
		if (!asked.ok) {
			suggestion =
				asked.error?.message ??
				"Budge couldn't ask the bank for a balance. Enter the starting balance.";
			return;
		}
		const outcome = asked.value;
		if (outcome.kind === 'suggested') {
			const amount = typed(shown(outcome.startingBalance));
			const basis =
				"from the bank's current balance, less the Transactions imported since the cutover date.";
			if (balance === typedBefore) {
				balance = amount;
				suggestion = `Budge suggests this ${basis}`;
			} else {
				suggestion = `Budge suggests ${amount} ${basis} Your entry stays.`;
			}
		} else if (outcome.kind === 'importing') {
			suggestion =
				"Budge is still bringing in this Account's rows. Suggest again in a moment, or enter the starting balance.";
		} else if (outcome.kind === 'noBalance') {
			suggestion = "The bank didn't report a balance for this Account. Enter the starting balance.";
		} else {
			synced = false;
		}
	}

	async function confirm(event: SubmitEvent) {
		event.preventDefault();
		const cents = parseCents(balance);
		if (cents === undefined) {
			error = 'Enter the balance as an amount, such as 1,250.00.';
			return;
		}
		const accountId = account._id;
		const startingBalance = owed ? -cents : cents;
		saving = true;
		error = '';
		const saved = await attempt(() =>
			client.mutation(api.accounts.setStartingBalance, { accountId, startingBalance })
		);
		saving = false;
		if (!saved.ok) {
			error = saved.error?.message ?? "Budge couldn't save the starting balance. Try again.";
			return;
		}
		onDone();
	}
</script>

<Dialog.Header>
	<Dialog.Title>Starting balance for {account.name}</Dialog.Title>
	<Dialog.Description>
		The starting balance is recorded on the cutover date. Confirm or correct it.
		{#if skippable}
			You can change it later from the Account's actions.
		{/if}
	</Dialog.Description>
</Dialog.Header>
<form class="flex flex-col gap-4" onsubmit={confirm}>
	<div class="flex flex-col gap-2">
		<Label for="starting-balance">
			{owed ? 'Amount owed on the cutover date' : 'Starting balance'}
		</Label>
		<Input
			id="starting-balance"
			bind:value={balance}
			inputmode="decimal"
			placeholder={suggesting && synced ? 'Asking the bank…' : '0.00'}
			autocomplete="off"
			required
		/>
	</div>
	<p role="status" class="text-sm text-muted-foreground">{suggestion}</p>
	{#if error}
		<p role="alert" class="text-sm text-destructive">{error}</p>
	{/if}
	<Dialog.Footer>
		{#if synced}
			<Button variant="outline" type="button" disabled={suggesting} onclick={suggest}>
				Suggest again
			</Button>
		{/if}
		<Button variant="outline" type="button" onclick={onDone}>
			{skippable ? 'Skip' : 'Cancel'}
		</Button>
		<Button type="submit" disabled={saving}>Confirm</Button>
	</Dialog.Footer>
</form>
