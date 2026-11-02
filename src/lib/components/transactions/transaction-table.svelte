<script lang="ts">
	import LockIcon from '@lucide/svelte/icons/lock';
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
	import { noFilters } from './filters';
	import TransactionFilters from './transaction-filters.svelte';

	type Row = FunctionReturnType<typeof api.transactions.list>['page'][number];

	/** One Account's Transactions, or All Accounts' when `accountId` is left out. */
	let { accountId }: { accountId?: Id<'accounts'> | undefined } = $props();

	const PAGE_SIZE = 50;
	const SEARCH_PAUSE_MS = 300;
	let filterValues = $state({ ...noFilters });
	/** The search once typing pauses, so each keystroke doesn't run one. */
	let search = $state('');
	$effect(() => {
		const typed = filterValues.search.trim();
		if (typed === '') {
			search = '';
			return;
		}
		const timer = setTimeout(() => (search = typed), SEARCH_PAUSE_MS);
		return () => {
			clearTimeout(timer);
		};
	});

	const allAccounts = $derived(accountId === undefined);
	// All Accounts' Account filter narrows it like an Account's own page.
	const scopeAccountId = $derived(
		accountId ??
			(filterValues.accountId === '' ? undefined : (filterValues.accountId as Id<'accounts'>))
	);
	const scope = $derived(scopeAccountId === undefined ? {} : { accountId: scopeAccountId });
	const filters = $derived({
		...(search === '' ? {} : { search }),
		...(filterValues.categoryId === ''
			? {}
			: { categoryId: filterValues.categoryId as Id<'categories'> }),
		...(filterValues.payeeId === '' ? {} : { payeeId: filterValues.payeeId as Id<'payees'> }),
		...(filterValues.from === '' ? {} : { from: filterValues.from }),
		...(filterValues.to === '' ? {} : { to: filterValues.to })
	});
	const filtering = $derived(Object.keys(filters).length > 0);
	// Unapproved first, then the approved ones once every Unapproved row is on screen. Filtered,
	// the list is one, newest first (best match first for a search); with a Category, the split
	// Transactions with a line in it follow the whole ones.
	const first = usePaginatedQuery(
		api.transactions.list,
		() => (filtering ? { ...scope, ...filters } : { ...scope, approval: 'unapproved' as const }),
		{ initialNumItems: PAGE_SIZE }
	);
	const hasSecond = $derived(!filtering || filters.categoryId !== undefined);
	const second = usePaginatedQuery(
		api.transactions.list,
		() =>
			first.status !== 'Exhausted' || !hasSecond
				? 'skip'
				: filtering
					? { ...scope, ...filters, splitLines: true }
					: { ...scope, approval: 'approved' as const },
		{ initialNumItems: PAGE_SIZE }
	);
	const unapprovedCount = useQuery(api.transactions.unapprovedCount, () => scope);
	const setCleared = useMutation(api.transactions.setCleared);
	const approve = useMutation(api.transactions.approve);
	const approveAll = useMutation(api.transactions.approveAll);

	const secondShown = $derived(first.status === 'Exhausted' && hasSecond);
	// A split with lines in the filtered Category could also be listed whole, so it shows once.
	const rows = $derived(
		[...first.results, ...(secondShown ? second.results : [])].filter(
			(row, index, all) => all.findIndex((other) => other._id === row._id) === index
		)
	);
	const loading = $derived(first.isLoading || (secondShown && second.isLoading));
	const more = $derived(secondShown ? second : first);
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
	<TransactionFilters bind:values={filterValues} showAccount={allAccounts} />
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
					<!-- A Transfer shows the other Account in place of a Category, and a split "Split". -->
					{@const category = row.transfer
						? `${row.amount < 0 ? 'To' : 'From'} ${row.transfer.accountName}`
						: row.splits
							? 'Split'
							: (row.categoryName ?? 'Uncategorized')}
					{@const categoryClass =
						row.categoryName === null && !row.transfer && !row.splits ? 'text-warning' : undefined}
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
							{#if row.reconciled}
								<!-- Locked: the Transaction's dialog unlocks it. -->
								<LockIcon aria-hidden="true" class="mx-auto size-4 text-muted-foreground" />
								<span class="sr-only">Reconciled</span>
							{:else}
								<Checkbox
									bind:checked={
										() => row.cleared, (checked: boolean) => void toggleCleared(row, checked)
									}
									aria-label="Cleared: {payee}, {formatDate(row.date)}"
								/>
							{/if}
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
					<!-- A filtered page can come back empty with more to read; say so only at the end. -->
					{#if loading || more.status === 'Exhausted'}
						<Table.Row>
							<Table.Cell colspan={allAccounts ? 8 : 7}>
								<span class="text-muted-foreground">
									{loading
										? 'Loading…'
										: filtering
											? 'No Transactions match.'
											: 'No Transactions yet.'}
								</span>
							</Table.Cell>
						</Table.Row>
					{/if}
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
	{#if first.error ?? second.error}
		<p role="alert" class="text-sm text-destructive">
			Budge couldn't load Transactions. Try reloading the page.
		</p>
	{/if}
</div>

<TransactionDialog bind:open={dialogOpen} transaction={editing} defaultAccountId={accountId} />
<ImportDialog bind:open={importOpen} defaultAccountId={accountId} />
