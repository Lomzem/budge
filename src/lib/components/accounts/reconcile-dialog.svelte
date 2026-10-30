<script lang="ts">
	import { useMutation, useQuery } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import type { Account } from '$lib/accounts.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { localToday } from '$lib/domain/dates';
	import { formatCents, parseCents } from '$lib/domain/money';
	import { readPublicError } from '$lib/publicError';

	let {
		open = $bindable(false),
		account,
		onReconciled
	}: {
		open?: boolean;
		account: Account;
		/** Called with the adjustment's amount, 0 when the balances agreed. */
		onReconciled: (adjustment: number) => void;
	} = $props();

	const cleared = useQuery(api.reconciliation.clearedBalance, () =>
		open ? { accountId: account._id } : 'skip'
	);
	const reconcile = useMutation(api.reconciliation.reconcile);

	let balance = $state('');
	let date = $state('');
	let error = $state('');
	let saving = $state(false);

	const isCard = $derived(account.kind === 'creditCard');
	const entered = $derived(balance.trim() === '' ? undefined : parseCents(balance));
	// A card's balance is what is owed, kept as a negative balance.
	const bankBalance = $derived(
		entered === undefined ? undefined : isCard && entered !== 0 ? -entered : entered
	);
	const difference = $derived(
		bankBalance === undefined || cleared.data === undefined ? undefined : bankBalance - cleared.data
	);

	$effect(() => {
		if (open) {
			balance = '';
			date = localToday();
			error = '';
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (bankBalance === undefined) {
			error = 'Enter the balance as an amount, such as 1,250.00.';
			return;
		}
		saving = true;
		try {
			const adjustment = await reconcile({ accountId: account._id, balance: bankBalance, date });
			open = false;
			onReconciled(adjustment);
		} catch (thrown) {
			error =
				readPublicError(thrown)?.message ?? "Budge couldn't reconcile the Account. Try again.";
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Reconcile {account.name}</Dialog.Title>
			<Dialog.Description>
				Enter what the bank shows. Budge compares it to the cleared balance, then locks the Cleared
				Transactions as Reconciled.
			</Dialog.Description>
		</Dialog.Header>
		<form class="flex flex-col gap-4" onsubmit={submit}>
			<p class="text-sm tabular-nums">
				<span class="text-muted-foreground">Cleared balance</span>
				<span data-testid="cleared-balance">
					{cleared.data === undefined ? '…' : formatCents(cleared.data)}
				</span>
			</p>
			<div class="flex flex-col gap-2">
				<Label for="reconcile-balance">
					{isCard ? 'Amount owed, per the bank' : 'Balance, per the bank'}
				</Label>
				<Input
					id="reconcile-balance"
					bind:value={balance}
					inputmode="decimal"
					placeholder="0.00"
					autocomplete="off"
					required
				/>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="reconcile-date">Date</Label>
				<Input id="reconcile-date" type="date" bind:value={date} required />
			</div>
			<p role="status" class="text-sm text-muted-foreground">
				{#if difference === 0}
					It matches the cleared balance.
				{:else if difference !== undefined}
					It differs by {formatCents(difference)}. Budge adds one Reconciliation Adjustment for it,
					in Ready to Assign, which you can change later.
				{/if}
			</p>
			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}
			<Dialog.Footer>
				<Button type="submit" disabled={saving}>Reconcile</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
