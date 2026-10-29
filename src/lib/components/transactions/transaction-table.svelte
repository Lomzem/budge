<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useMutation, usePaginatedQuery } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Table from '$lib/components/ui/table';
	import { formatDate } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';

	import TransactionDialog from './transaction-dialog.svelte';

	type Row = FunctionReturnType<typeof api.transactions.list>['page'][number];

	/** One Account's Transactions, or All Accounts' when `accountId` is left out. */
	let { accountId }: { accountId?: Id<'accounts'> | undefined } = $props();

	const PAGE_SIZE = 50;
	const transactions = usePaginatedQuery(
		api.transactions.list,
		() => (accountId === undefined ? {} : { accountId }),
		{ initialNumItems: PAGE_SIZE }
	);
	const setCleared = useMutation(api.transactions.setCleared);

	const allAccounts = $derived(accountId === undefined);
	let dialogOpen = $state(false);
	let editing: Row | undefined = $state();
	let clearedError = $state('');

	function add() {
		editing = undefined;
		dialogOpen = true;
	}

	function edit(row: Row) {
		editing = row;
		dialogOpen = true;
	}

	async function toggleCleared(row: Row, cleared: boolean) {
		clearedError = '';
		try {
			await setCleared({ transactionId: row._id, cleared });
		} catch {
			clearedError = "Budge couldn't change Cleared. Try again.";
		}
	}
</script>

<div class="flex flex-col gap-3">
	<div>
		<Button onclick={add}>Add Transaction</Button>
	</div>
	{#if clearedError}
		<p role="alert" class="text-sm text-destructive">{clearedError}</p>
	{/if}
	<!-- Columns drop as the list narrows; what they held moves under the Payee. -->
	<div class="@container">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head width="fit">Date</Table.Head>
					{#if allAccounts}
						<Table.Head showFrom="2xl">Account</Table.Head>
					{/if}
					<Table.Head width="fill">Payee</Table.Head>
					<Table.Head showFrom="lg">Category</Table.Head>
					<Table.Head showFrom="xl">Memo</Table.Head>
					<Table.Head width="fit" align="end">Amount</Table.Head>
					<Table.Head width="fit" align="center">Cleared</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each transactions.results as row (row._id)}
					{@const payee = row.payeeName ?? (row.transfer ? 'Transfer' : 'No Payee')}
					<!-- A Transfer shows the other Account in place of a Category. -->
					{@const category = row.transfer
						? `${row.amount < 0 ? 'To' : 'From'} ${row.transfer.accountName}`
						: (row.categoryName ?? 'Uncategorized')}
					{@const categoryClass =
						row.categoryName === null && !row.transfer ? 'text-warning' : undefined}
					<Table.Row>
						<Table.Cell numeric>
							<time datetime={row.date}>
								<span class="@md:hidden">{formatDate(row.date, 'short')}</span>
								<span class="hidden @md:inline">{formatDate(row.date)}</span>
							</time>
						</Table.Cell>
						{#if allAccounts}
							<Table.Cell showFrom="2xl">{row.accountName}</Table.Cell>
						{/if}
						<Table.Cell width="fill">
							<button
								class="block max-w-full truncate rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
								onclick={() => {
									edit(row);
								}}
							>
								<span
									class={row.payeeName === null && !row.transfer
										? 'text-muted-foreground'
										: undefined}
								>
									{payee}
								</span>
								<span class="sr-only">, edit Transaction on {formatDate(row.date)}</span>
							</button>
							<span class="block truncate text-xs text-muted-foreground @lg:hidden">
								<span class={categoryClass}>{category}</span>
							</span>
							{#if allAccounts}
								<span class="block truncate text-xs text-muted-foreground @2xl:hidden">
									{row.accountName}
								</span>
							{/if}
							{#if row.memo}
								<span class="block truncate text-xs text-muted-foreground @xl:hidden">
									{row.memo}
								</span>
							{/if}
						</Table.Cell>
						<Table.Cell showFrom="lg">
							<span class={['block max-w-48 truncate', categoryClass]}>{category}</span>
						</Table.Cell>
						<Table.Cell showFrom="xl">
							<span class="block max-w-60 truncate">{row.memo ?? ''}</span>
						</Table.Cell>
						<Table.Cell align="end" numeric>{formatCents(row.amount)}</Table.Cell>
						<Table.Cell align="center">
							<Checkbox
								bind:checked={
									() => row.cleared, (checked: boolean) => void toggleCleared(row, checked)
								}
								aria-label="Cleared: {payee}, {formatDate(row.date)}"
							/>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={allAccounts ? 7 : 6}>
							<span class="text-muted-foreground">
								{transactions.isLoading ? 'Loading…' : 'No Transactions yet.'}
							</span>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
	{#if transactions.status === 'CanLoadMore' || transactions.status === 'LoadingMore'}
		<div>
			<Button
				variant="outline"
				disabled={transactions.status === 'LoadingMore'}
				onclick={() => transactions.loadMore(PAGE_SIZE)}
			>
				{transactions.status === 'LoadingMore' ? 'Loading…' : 'Show more'}
			</Button>
		</div>
	{/if}
	{#if transactions.error}
		<p role="alert" class="text-sm text-destructive">
			Budge couldn't load Transactions. Try reloading the page.
		</p>
	{/if}
</div>

<TransactionDialog bind:open={dialogOpen} transaction={editing} defaultAccountId={accountId} />
