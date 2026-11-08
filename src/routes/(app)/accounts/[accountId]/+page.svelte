<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';

	import { resolve } from '$app/paths';
	import { getAccounts, type Account } from '$lib/accounts.svelte';
	import { attempt } from '$lib/attempt';
	import ReconcileDialog from '$lib/components/accounts/reconcile-dialog.svelte';
	import RenameAccountDialog from '$lib/components/accounts/rename-account-dialog.svelte';
	import StartingBalanceStep from '$lib/components/accounts/starting-balance-step.svelte';
	import TransactionTable from '$lib/components/transactions/transaction-table.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { formatDate } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';
	import { DialogSession } from '$lib/dialogSession.svelte';

	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const accounts = getAccounts();
	const account = $derived(accounts.find(params.accountId));
	let renameOpen = $state(false);
	let reconcileOpen = $state(false);
	let moveError = $state('');
	const startingBalance = new DialogSession<{
		account: { _id: Account['_id']; kind: Account['kind']; name: string };
	}>();

	let reconciled: { accountId: string; message: string } | undefined = $state();

	function onReconciled(adjustment: number) {
		reconciled = {
			accountId: params.accountId,
			message:
				adjustment === 0
					? 'Reconciled. The balances matched.'
					: `Reconciled, with a Reconciliation Adjustment of ${formatCents(adjustment)}.`
		};
	}

	async function move(direction: -1 | 1) {
		if (!account) return;
		moveError = '';
		const accountId = account._id;
		const moved = await attempt(() => accounts.move(accountId, direction));
		if (!moved.ok) moveError = "Budge couldn't move the Account. Try again.";
	}

	function editStartingBalance(chosen: Account) {
		startingBalance.open({ account: { _id: chosen._id, kind: chosen.kind, name: chosen.name } });
	}
</script>

<svelte:head>
	<title>{account?.name ?? 'Account'} · Budge</title>
</svelte:head>

{#if account}
	<div class="flex flex-col gap-4">
		<header class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
			<div class="flex min-w-0 flex-col gap-1">
				<p class="text-sm text-muted-foreground">
					{account.kind === 'creditCard' ? 'Credit card' : 'Cash'} Account
				</p>
				<div class="-mr-2 flex min-w-0 items-center gap-1">
					<h1 class="truncate text-2xl font-bold tracking-tight">{account.name}</h1>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<Button variant="ghost" size="icon" aria-label="{account.name} actions" {...props}>
									<EllipsisIcon aria-hidden="true" />
								</Button>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="start">
							<DropdownMenu.Item onSelect={() => (renameOpen = true)}>Rename</DropdownMenu.Item>
							<DropdownMenu.Item
								disabled={!accounts.canMove(account._id, -1)}
								onSelect={() => void move(-1)}
							>
								Move up
							</DropdownMenu.Item>
							<DropdownMenu.Item
								disabled={!accounts.canMove(account._id, 1)}
								onSelect={() => void move(1)}
							>
								Move down
							</DropdownMenu.Item>
							<DropdownMenu.Item
								onSelect={() => {
									editStartingBalance(account);
								}}
							>
								Starting balance
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			</div>
			<div class="flex flex-wrap items-end gap-x-6 gap-y-3">
				<div class="flex flex-col items-start sm:items-end">
					<p class="text-sm font-bold">Balance</p>
					<p
						data-testid="account-balance"
						class={[
							'border-b-4 border-double border-current text-2xl font-bold',
							account.balance < 0 && 'text-destructive'
						]}
					>
						{formatCents(account.balance)}
					</p>
				</div>
				<div class="flex flex-col items-start gap-1">
					<p class="text-sm text-muted-foreground" data-testid="last-reconciled">
						{#if account.lastReconciledOn}
							Reconciled
							<time datetime={account.lastReconciledOn}>{formatDate(account.lastReconciledOn)}</time
							>
						{:else}
							Not reconciled yet
						{/if}
					</p>
					<Button variant="outline" size="sm" onclick={() => (reconcileOpen = true)}>
						Reconcile
					</Button>
				</div>
			</div>
		</header>
		<div class="-my-1 min-h-6 text-sm">
			<p role="status">
				{reconciled?.accountId === account._id ? reconciled.message : ''}
			</p>
			<p role="alert" class="text-destructive">{moveError}</p>
		</div>
		{#key account._id}
			<TransactionTable accountId={account._id} />
		{/key}
	</div>
	<RenameAccountDialog bind:open={renameOpen} accountId={account._id} currentName={account.name} />
	<ReconcileDialog bind:open={reconcileOpen} {account} {onReconciled} />
	<Dialog.Root
		open={startingBalance.current !== null}
		onOpenChange={(isOpen) => {
			if (!isOpen) startingBalance.dismiss();
		}}
	>
		<Dialog.Content>
			{#if startingBalance.current !== null}
				{@const session = startingBalance.current}
				{#key session}
					<StartingBalanceStep
						account={session.account}
						onDone={() => {
							startingBalance.close(session);
						}}
					/>
				{/key}
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{:else if accounts.loaded}
	<h1 class="text-2xl font-bold tracking-tight">No such Account</h1>
	<p class="mt-2 text-muted-foreground">
		It may have been removed.
		<a class="underline underline-offset-4 hover:no-underline" href={resolve('/accounts')}
			>See every Account</a
		>.
	</p>
{:else}
	<p role="status" class="text-muted-foreground">Loading…</p>
{/if}
