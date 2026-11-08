<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';

	import { resolve } from '$app/paths';
	import { getAccounts, type Account } from '$lib/accounts.svelte';
	import { attempt } from '$lib/attempt';
	import { attentionOf, getBankConnections } from '$lib/bankConnections.svelte';
	import ReconcileDialog from '$lib/components/accounts/reconcile-dialog.svelte';
	import RenameAccountDialog from '$lib/components/accounts/rename-account-dialog.svelte';
	import StartingBalanceStep from '$lib/components/accounts/starting-balance-step.svelte';
	import TransactionTable from '$lib/components/transactions/transaction-table.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { formatDate } from '$lib/domain/dates';
	import { formatSynced } from '$lib/domain/freshness';
	import { formatCents } from '$lib/domain/money';
	import { DialogSession } from '$lib/dialogSession.svelte';

	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const accounts = getAccounts();
	const account = $derived(accounts.find(params.accountId));
	const bank = getBankConnections();
	const feeder = $derived(
		bank.all.find((connection) =>
			connection.feeds.some((feed) => feed.accountId === params.accountId)
		)
	);
	let renameOpen = $state(false);
	let reconcileOpen = $state(false);
	let moveError = $state('');
	const startingBalance = new DialogSession<{
		account: { _id: Account['_id']; kind: Account['kind']; name: string };
	}>();

	let notice: { accountId: string; message: string } | undefined = $state();
	const noticeText = $derived(notice?.accountId === params.accountId ? notice.message : '');
	let actionsButton: HTMLButtonElement | null = $state(null);

	function dismiss() {
		notice = undefined;
		moveError = '';
		actionsButton?.focus();
	}

	async function stopSyncing() {
		const feed = feeder?.feeds.find((candidate) => candidate.accountId === params.accountId);
		if (!feeder || !feed) return;
		const accountId = params.accountId;
		const bankName = feeder.name;
		moveError = '';
		const report = await bank.stopSyncing(feed.connectionAccountId, feed.name);
		if (report.failed) moveError = report.text;
		else {
			notice = {
				accountId,
				message: `Stopped syncing from ${bankName}. Its Transactions stay; bring it back from the Bank page.`
			};
		}
	}

	function onReconciled(adjustment: number) {
		notice = {
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
				<div class="-mr-2 flex min-w-0 items-center gap-1">
					<h1 class="truncate text-2xl font-bold tracking-tight">{account.name}</h1>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<Button
									bind:ref={actionsButton}
									variant="ghost"
									size="icon"
									aria-label="{account.name} actions"
									{...props}
								>
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
							{#if feeder}
								<DropdownMenu.Separator />
								<DropdownMenu.Item onSelect={() => void stopSyncing()}>
									Stop syncing from {feeder.name}
								</DropdownMenu.Item>
							{/if}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
				<p class="text-sm text-muted-foreground">
					{account.kind === 'creditCard' ? 'Credit card' : 'Cash'} Account
				</p>
				<p
					class="line-clamp-2 min-h-12 text-sm/6 break-words text-muted-foreground sm:line-clamp-1 sm:min-h-6"
					data-testid="account-sync"
				>
					{#if feeder}
						{@const attention = attentionOf(feeder)}
						{#if attention !== null}
							<a
								href="{resolve('/bank')}#connection-{feeder._id}"
								class="mr-1 rounded-full bg-warning-tint px-2 py-0.5 text-xs font-bold text-warning underline-offset-4 hover:underline"
								>{attention}<span class="sr-only">: {feeder.name}</span></a
							>
						{/if}
						{formatSynced(feeder.lastSyncedAt, bank.now)} from
						<a
							href={resolve('/bank')}
							class="font-medium text-foreground underline underline-offset-4 hover:no-underline"
							>{feeder.name}</a
						>
					{:else if bank.loaded}
						Entered by hand or from bank files
					{/if}
				</p>
			</div>
			<div
				class="grid w-full items-end gap-x-4 sm:flex sm:w-auto sm:flex-wrap sm:gap-x-6 sm:gap-y-3"
			>
				<div class="contents sm:flex sm:flex-col sm:items-end">
					<p class="col-start-1 text-sm font-bold">Balance</p>
					<p
						data-testid="account-balance"
						class={[
							'col-start-1 w-fit border-b-4 border-double border-current text-2xl font-bold',
							account.balance < 0 && 'text-destructive'
						]}
					>
						{formatCents(account.balance)}
					</p>
				</div>
				<div class="contents sm:flex sm:flex-col sm:items-start sm:gap-1">
					<p
						class="col-start-1 mt-1 text-sm text-muted-foreground sm:mt-0"
						data-testid="last-reconciled"
					>
						{#if account.lastReconciledOn}
							Reconciled
							<time datetime={account.lastReconciledOn}>{formatDate(account.lastReconciledOn)}</time
							>
						{:else}
							Not reconciled yet
						{/if}
					</p>
					<div class="col-start-2 row-span-3 row-start-1 self-end justify-self-end">
						<Button variant="outline" size="sm" onclick={() => (reconcileOpen = true)}>
							Reconcile
						</Button>
					</div>
				</div>
			</div>
		</header>
		{#key account._id}
			<TransactionTable accountId={account._id} />
		{/key}
	</div>
	<div
		class={noticeText === '' && moveError === ''
			? 'sr-only'
			: 'fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-md border bg-popover py-2 pr-2 pl-4 text-sm shadow-lg lg:bottom-6'}
	>
		<div class="min-w-0 flex-1">
			<p role="status">{noticeText}</p>
			<p role="alert" class="text-destructive">{moveError}</p>
		</div>
		{#if noticeText !== '' || moveError !== ''}
			<Button variant="ghost" size="sm" onclick={dismiss}>Dismiss</Button>
		{/if}
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
