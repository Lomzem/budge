<script lang="ts">
	import { useMutation, useQuery } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import type { Account } from '$lib/accounts.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import { localToday } from '$lib/domain/dates';
	import { formatCents, parseCents } from '$lib/domain/money';

	let {
		open = $bindable(false),
		account,
		onReconciled
	}: {
		open?: boolean;
		account: Account;

		onReconciled: (adjustment: number) => void;
	} = $props();

	const cleared = useQuery(api.reconciliation.clearedBalance, () =>
		open ? { accountId: account._id } : 'skip'
	);
	const reconcile = useMutation(api.reconciliation.reconcile);

	let balance = $state('');
	let date = $state('');
	let error = $state('');
	const dialog = new DialogSession();

	const isCard = $derived(account.kind === 'creditCard');
	const entered = $derived(balance.trim() === '' ? undefined : parseCents(balance));

	const owed = (cents: number) => (isCard && cents !== 0 ? -cents : cents);
	const bankBalance = $derived(entered === undefined ? undefined : owed(entered));

	const clearedBalance = $derived(cleared.data?.balance);
	const unapproved = $derived(cleared.data?.unapproved ?? 0);
	const clearedShown = $derived(clearedBalance === undefined ? undefined : owed(clearedBalance));
	const difference = $derived(
		bankBalance === undefined || clearedBalance === undefined
			? undefined
			: bankBalance - clearedBalance
	);
	const unapprovedWarning = $derived(
		unapproved === 1
			? '1 Cleared Transaction is still Unapproved. Reconciling locks it as it is, so review it first if anything looks wrong.'
			: `${String(unapproved)} Cleared Transactions are still Unapproved. Reconciling locks them as they are, so review them first if anything looks wrong.`
	);
	const submitLabel = $derived(
		difference === undefined || difference === 0
			? 'Reconcile'
			: `Reconcile with ${formatCents(difference)} adjustment`
	);

	$effect(() => {
		if (open) {
			dialog.open({});
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
		await reconcileAt(bankBalance);
	}

	async function matchCleared() {
		if (clearedBalance === undefined || dialog.pending('save')) return;
		await reconcileAt(clearedBalance);
	}

	async function reconcileAt(balance: number) {
		const reconciled = await dialog.run('save', () =>
			reconcile({ accountId: account._id, balance, date })
		);
		if (!reconciled.ok) {
			error = reconciled.error?.message ?? "Budge couldn't reconcile the Account. Try again.";
			return;
		}
		open = false;
		onReconciled(reconciled.value);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		onOpenAutoFocus={(event: Event) => {
			event.preventDefault();
			document.getElementById('reconcile-balance')?.focus();
		}}
	>
		<Dialog.Header>
			<Dialog.Title>Reconcile {account.name}</Dialog.Title>
			<Dialog.Description>
				If the bank shows the cleared balance, confirm it in one tap. Otherwise enter what the bank
				shows; Budge adds an adjustment for the difference. Either way, the Cleared Transactions
				lock as Reconciled.
			</Dialog.Description>
		</Dialog.Header>
		<form class="flex flex-col gap-4" onsubmit={submit}>
			<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<p class="text-sm tabular-nums">
					<span class="text-muted-foreground">
						{isCard ? 'Cleared amount owed' : 'Cleared balance'}
					</span>
					<span data-testid="cleared-balance">
						{clearedShown === undefined ? '…' : formatCents(clearedShown)}
					</span>
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-disabled={clearedShown === undefined || dialog.pending('save')}
					aria-label="The bank shows the same: reconcile at {clearedShown === undefined
						? '…'
						: formatCents(clearedShown)}"
					onclick={matchCleared}
				>
					The bank shows the same
				</Button>
			</div>
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
			{#if unapproved > 0}
				<p class="text-sm text-warning">{unapprovedWarning}</p>
			{/if}
			<p role="status" class="text-sm text-muted-foreground">
				{#if difference === 0}
					It matches the cleared balance.
				{:else if difference !== undefined}
					It differs by {formatCents(difference)}. Budge adds one Reconciliation Adjustment for it,
					in Ready to Assign, which you can change later.
				{/if}
			</p>
			<Dialog.Footer {error}>
				<Button type="submit" disabled={dialog.pending('save')}>{submitLabel}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
