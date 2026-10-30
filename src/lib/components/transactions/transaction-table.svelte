<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useMutation, usePaginatedQuery, useQuery } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Table from '$lib/components/ui/table';
	import { formatDate } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';
	import { formatUnapprovedCount, UNAPPROVED_COUNT_LIMIT } from '$lib/domain/unapproved';

	import ImportDialog from './import-dialog.svelte';
	import TransactionDialog from './transaction-dialog.svelte';

	type Row = FunctionReturnType<typeof api.transactions.list>['page'][number];

	/** One Account's Transactions, or All Accounts' when `accountId` is left out. */
	let { accountId }: { accountId?: Id<'accounts'> | undefined } = $props();

	const PAGE_SIZE = 50;
	const scope = $derived(accountId === undefined ? {} : { accountId });
	// Unapproved first: the approved list starts once every Unapproved row is on screen.
	const unapproved = usePaginatedQuery(
		api.transactions.list,
		() => ({ ...scope, approval: 'unapproved' as const }),
		{ initialNumItems: PAGE_SIZE }
	);
	const approved = usePaginatedQuery(
		api.transactions.list,
		() =>
			unapproved.status === 'Exhausted' ? { ...scope, approval: 'approved' as const } : 'skip',
		{ initialNumItems: PAGE_SIZE }
	);
	const unapprovedCount = useQuery(api.transactions.unapprovedCount, () => scope);
	const setCleared = useMutation(api.transactions.setCleared);
	const approve = useMutation(api.transactions.approve);
	const approveAll = useMutation(api.transactions.approveAll);

	const allAccounts = $derived(accountId === undefined);
	const rows = $derived([...unapproved.results, ...approved.results]);
	const loading = $derived(
		unapproved.isLoading || (unapproved.status === 'Exhausted' && approved.isLoading)
	);
	const more = $derived(unapproved.status === 'Exhausted' ? approved : unapproved);
	let dialogOpen = $state(false);
	let importOpen = $state(false);
	let editing: Row | undefined = $state();
	let rowError = $state('');
	let approvingAll = $state(false);

	function add() {
		editing = undefined;
		dialogOpen = true;
	}

	function edit(row: Row) {
		editing = row;
		dialogOpen = true;
	}

	async function toggleCleared(row: Row, cleared: boolean) {
		rowError = '';
		try {
			await setCleared({ transactionId: row._id, cleared });
		} catch {
			rowError = "Budge couldn't change Cleared. Try again.";
		}
	}

	async function approveRow(row: Row) {
		rowError = '';
		try {
			await approve({ transactionId: row._id });
		} catch {
			rowError = "Budge couldn't approve the Transaction. Try again.";
		}
	}

	async function approveEvery() {
		rowError = '';
		approvingAll = true;
		try {
			await approveAll(scope);
		} catch {
			rowError = "Budge couldn't approve the Transactions. Try again.";
		} finally {
			approvingAll = false;
		}
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center gap-2">
		<Button onclick={add}>Add Transaction</Button>
		<Button variant="outline" onclick={() => (importOpen = true)}>Import file</Button>
		{#if (unapprovedCount.data ?? 0) > 0}
			<Button variant="outline" disabled={approvingAll} onclick={approveEvery}>
				<!-- One "Approve all" approves at most the limit; the rest stay for the next. -->
				{(unapprovedCount.data ?? 0) > UNAPPROVED_COUNT_LIMIT
					? `Approve ${formatUnapprovedCount(UNAPPROVED_COUNT_LIMIT)}`
					: `Approve all ${formatUnapprovedCount(unapprovedCount.data ?? 0)}`}
			</Button>
		{/if}
	</div>
	{#if rowError}
		<p role="alert" class="text-sm text-destructive">{rowError}</p>
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
					<Table.Head width="fit"><span class="sr-only">Approval</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each rows as row (row._id)}
					{@const payee = row.payeeName ?? (row.transfer ? 'Transfer' : 'No Payee')}
					<!-- A Transfer shows the other Account in place of a Category. -->
					{@const category = row.transfer
						? `${row.amount < 0 ? 'To' : 'From'} ${row.transfer.accountName}`
						: (row.categoryName ?? 'Uncategorized')}
					{@const categoryClass =
						row.categoryName === null && !row.transfer ? 'text-warning' : undefined}
					<Table.Row weight={row.approved ? 'normal' : 'strong'}>
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
								<span class="sr-only">
									, {row.approved ? '' : 'Unapproved, '}edit Transaction on {formatDate(row.date)}
								</span>
							</button>
							<span class="block truncate text-xs font-normal text-muted-foreground @lg:hidden">
								<span class={categoryClass}>{category}</span>
							</span>
							{#if allAccounts}
								<span class="block truncate text-xs font-normal text-muted-foreground @2xl:hidden">
									{row.accountName}
								</span>
							{/if}
							{#if row.memo}
								<span class="block truncate text-xs font-normal text-muted-foreground @xl:hidden">
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
						<Table.Cell>
							{#if !row.approved}
								<Button
									size="sm"
									variant="outline"
									onclick={() => approveRow(row)}
									aria-label="Approve {payee}, {formatDate(row.date)}"
								>
									Approve
								</Button>
							{/if}
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={allAccounts ? 8 : 7}>
							<span class="text-muted-foreground">
								{loading ? 'Loading…' : 'No Transactions yet.'}
							</span>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
	{#if more.status === 'CanLoadMore' || more.status === 'LoadingMore'}
		<div>
			<Button
				variant="outline"
				disabled={more.status === 'LoadingMore'}
				onclick={() => more.loadMore(PAGE_SIZE)}
			>
				{more.status === 'LoadingMore' ? 'Loading…' : 'Show more'}
			</Button>
		</div>
	{/if}
	{#if unapproved.error ?? approved.error}
		<p role="alert" class="text-sm text-destructive">
			Budge couldn't load Transactions. Try reloading the page.
		</p>
	{/if}
</div>

<TransactionDialog bind:open={dialogOpen} transaction={editing} defaultAccountId={accountId} />
<ImportDialog bind:open={importOpen} defaultAccountId={accountId} />
