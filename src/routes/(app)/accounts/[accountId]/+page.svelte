<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';

	import { resolve } from '$app/paths';
	import { getAccounts } from '$lib/accounts.svelte';
	import ReconcileDialog from '$lib/components/accounts/reconcile-dialog.svelte';
	import RenameAccountDialog from '$lib/components/accounts/rename-account-dialog.svelte';
	import TransactionTable from '$lib/components/transactions/transaction-table.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { formatDate } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';

	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const accounts = getAccounts();
	const account = $derived(accounts.find(params.accountId));
	let renameOpen = $state(false);
	let reconcileOpen = $state(false);
	let moveError = $state('');
	// Kept with its Account, so the message doesn't follow the owner to another.
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
		try {
			await accounts.move(account._id, direction);
		} catch {
			moveError = "Budge couldn't move the Account. Try again.";
		}
	}
</script>

<svelte:head>
	<title>{account?.name ?? 'Account'} · Budge</title>
</svelte:head>

{#if account}
	<div class="flex flex-col gap-4">
		<header class="flex flex-wrap items-center justify-between gap-2">
			<div class="flex min-w-0 items-center gap-1">
				<h1 class="truncate text-xl font-semibold">{account.name}</h1>
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
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
			<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
				<p class="tabular-nums">
					<span class="text-muted-foreground">Balance</span>
					<span data-testid="account-balance">{formatCents(account.balance)}</span>
				</p>
				<p class="text-sm text-muted-foreground" data-testid="last-reconciled">
					{#if account.lastReconciledOn}
						Reconciled
						<time datetime={account.lastReconciledOn}>{formatDate(account.lastReconciledOn)}</time>
					{:else}
						Not reconciled yet
					{/if}
				</p>
				<Button variant="outline" size="sm" onclick={() => (reconcileOpen = true)}>Reconcile</Button
				>
			</div>
		</header>
		{#if reconciled?.accountId === account._id}
			<p role="status" class="text-sm">{reconciled.message}</p>
		{/if}
		{#if moveError}
			<p role="alert" class="text-sm text-destructive">{moveError}</p>
		{/if}
		{#key account._id}
			<TransactionTable accountId={account._id} />
		{/key}
	</div>
	<RenameAccountDialog bind:open={renameOpen} accountId={account._id} currentName={account.name} />
	<ReconcileDialog bind:open={reconcileOpen} {account} {onReconciled} />
{:else if accounts.loaded}
	<h1 class="text-xl font-semibold">No such Account</h1>
	<p class="mt-2 text-muted-foreground">
		It may have been removed. <a class="underline" href={resolve('/accounts')}>See All Accounts</a>.
	</p>
{:else}
	<p role="status" class="text-muted-foreground">Loading…</p>
{/if}
