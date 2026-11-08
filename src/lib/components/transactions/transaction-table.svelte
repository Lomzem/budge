<script lang="ts">
	import CheckCheckIcon from '@lucide/svelte/icons/check-check';
	import LockIcon from '@lucide/svelte/icons/lock';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import type { FunctionReturnType } from 'convex/server';
	import { useMutation, usePaginatedQuery, useQuery } from 'convex-svelte';
	import { tick } from 'svelte';

	import { replaceState } from '$app/navigation';
	import type { ResolvedPathname } from '$app/types';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { attempt } from '$lib/attempt';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Table from '$lib/components/ui/table';
	import { formatDate } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';
	import { formatUnapprovedCount, UNAPPROVED_COUNT_LIMIT } from '$lib/domain/unapproved';

	import ImportDialog from './import-dialog.svelte';
	import TransactionDialog from './transaction-dialog.svelte';
	import {
		BANK_CHANGES,
		countedTransactions,
		filtersFromUrl,
		UNAPPROVED,
		UNCATEGORIZED,
		urlWithFilters
	} from './filters';
	import TransactionFilters from './transaction-filters.svelte';

	type Row = FunctionReturnType<typeof api.transactions.list>['page'][number];

	let { accountId }: { accountId?: Id<'accounts'> | undefined } = $props();

	const PAGE_SIZE = 50;

	function bankFlag(row: Row) {
		if (row.bankRows.some((bankRow) => bankRow.state === 'removed')) return 'Bank removed this';
		if (row.bankRows.some((bankRow) => bankRow.state === 'changed')) return 'Bank changed this';
		return undefined;
	}

	function categoryFilter(value: string) {
		if (value === '') return {};
		if (value === UNCATEGORIZED) return { uncategorized: true as const };
		return { categoryId: value as Id<'categories'> };
	}

	const SEARCH_PAUSE_MS = 300;
	let filterValues = $state(filtersFromUrl(page.url));
	let arrivedAt = page.url;
	$effect(() => {
		const url = page.url;
		if (url === arrivedAt) return;
		arrivedAt = url;
		filterValues = filtersFromUrl(url);
	});
	$effect(() => {
		const kept = urlWithFilters(new URL(location.href), filterValues);
		if (kept.href === location.href) return;
		const samePage = `${kept.pathname}${kept.search}${kept.hash}` as ResolvedPathname;
		replaceState(samePage, page.state);
	});

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
	const memoFrom = $derived(allAccounts ? '8xl' : '6xl');

	const scopeAccountId = $derived(
		accountId ??
			(filterValues.accountId === '' ? undefined : (filterValues.accountId as Id<'accounts'>))
	);
	const scope = $derived(scopeAccountId === undefined ? {} : { accountId: scopeAccountId });
	const filters = $derived({
		...(search === '' ? {} : { search }),
		...categoryFilter(filterValues.categoryId),
		...(filterValues.status === UNAPPROVED ? { approval: 'unapproved' as const } : {}),
		...(filterValues.status === BANK_CHANGES ? { bankChanges: true as const } : {}),
		...(filterValues.payeeId === '' ? {} : { payeeId: filterValues.payeeId as Id<'payees'> }),
		...(filterValues.from === '' ? {} : { from: filterValues.from }),
		...(filterValues.to === '' ? {} : { to: filterValues.to })
	});
	const filtering = $derived(Object.keys(filters).length > 0);

	const first = usePaginatedQuery(
		api.transactions.list,
		() => (filtering ? { ...scope, ...filters } : { ...scope, approval: 'unapproved' as const }),
		{ initialNumItems: PAGE_SIZE }
	);
	const hasSecond = $derived(
		!filtering || (filters.categoryId !== undefined && filters.bankChanges === undefined)
	);
	const second = usePaginatedQuery(
		api.transactions.list,
		() => {
			if (first.status !== 'Exhausted' || !hasSecond) return 'skip';
			return filtering
				? { ...scope, ...filters, splitLines: true }
				: { ...scope, approval: 'approved' as const };
		},
		{ initialNumItems: PAGE_SIZE }
	);
	const unapprovedCount = useQuery(api.transactions.unapprovedCount, () => scope);
	const setCleared = useMutation(api.transactions.setCleared);
	const approve = useMutation(api.transactions.approve);
	const approveAll = useMutation(api.transactions.approveAll);
	const approveMany = useMutation(api.transactions.approveMany);
	const unapprove = useMutation(api.transactions.unapprove);
	let undoable = $state<{ scopeKey: string; transactionIds: Id<'transactions'>[] } | null>(null);
	const scopeKey = $derived(JSON.stringify([scope, filters]));
	const undo = $derived(undoable?.scopeKey === scopeKey ? undoable : null);

	const approveAllLabel = $derived.by(() => {
		if (shownUnapproved !== null) {
			const shown = shownUnapproved.length;
			return shown === 0 ? 'Approve shown' : `Approve ${String(shown)} shown`;
		}
		const count = unapprovedCount.data ?? 0;
		if (count === 0) return 'Approve all';
		if (count > UNAPPROVED_COUNT_LIMIT)
			return `Approve ${formatUnapprovedCount(UNAPPROVED_COUNT_LIMIT)}`;
		if (count === 1) return 'Approve 1';
		return `Approve all ${formatUnapprovedCount(count)}`;
	});

	const problem = $derived.by(() => {
		if (rowError !== '') return rowError;
		if (first.error ?? second.error)
			return "Budge couldn't load Transactions. Try reloading the page.";
		return '';
	});

	const secondShown = $derived(first.status === 'Exhausted' && hasSecond);

	const rows = $derived(
		[...first.results, ...(secondShown ? second.results : [])].filter(
			(row, index, all) => all.findIndex((other) => other._id === row._id) === index
		)
	);
	const shownUnapproved = $derived(
		filtering
			? rows
					.filter((row) => !row.approved)
					.slice(0, UNAPPROVED_COUNT_LIMIT)
					.map((row) => row._id)
			: null
	);
	const groups = $derived.by(() => {
		const waiting = rows.filter((row) => !row.approved);
		if (filtering || waiting.length === 0) return [{ label: '', rows }];
		return [
			{ label: 'Unapproved', rows: waiting },
			{ label: 'Approved', rows: rows.filter((row) => row.approved) }
		];
	});
	const loading = $derived(first.isLoading || (secondShown && second.isLoading));
	const more = $derived(secondShown ? second : first);
	const canShowMore = $derived(more.status === 'CanLoadMore' || more.status === 'LoadingMore');
	const result = $derived.by(() => {
		if (rows.length === 0 && loading) return 'Loading Transactions…';
		if (rows.length === 0 && filters.bankChanges) return 'No bank changes wait on you.';
		if (rows.length === 0) return filtering ? 'No Transactions match.' : 'No Transactions yet.';
		const counted = countedTransactions(rows.length, filterValues);
		return canShowMore ? `${counted} shown, more below` : counted;
	});
	let announcement = $state('');
	function announce(message: string) {
		announcement = announcement === message ? `${message}\u00a0` : message;
	}
	let addButton: HTMLButtonElement | HTMLAnchorElement | null = $state(null);
	let approveAllButton: HTMLButtonElement | HTMLAnchorElement | null = $state(null);
	function shownOf(selector: string) {
		return [...document.querySelectorAll<HTMLElement>(selector)].find((element) =>
			element.checkVisibility()
		);
	}
	const editButtonOf = (row: Row | undefined) =>
		row === undefined ? undefined : shownOf(`[data-edit="${row._id}"]`);
	let dialogOpen = $state(false);
	let importOpen = $state(false);
	let editingSnapshot: Row | undefined = $state();
	let editingAt = -1;
	let deletedId: Id<'transactions'> | null = null;
	const editing = $derived(
		editingSnapshot === undefined
			? undefined
			: (rows.find((row) => row._id === editingSnapshot?._id) ?? editingSnapshot)
	);
	let rowError = $state('');
	let approvingAll = $state(false);
	const approveAllBlocked = $derived(
		approvingAll || (shownUnapproved?.length ?? unapprovedCount.data ?? 0) === 0
	);

	function add() {
		editingSnapshot = undefined;
		dialogOpen = true;
	}

	function returnFocus() {
		if (editingSnapshot === undefined) return addButton ?? undefined;
		const remaining = rows.filter((row) => row._id !== deletedId);
		const candidates =
			deletedId === editingSnapshot._id
				? [remaining[editingAt], remaining[editingAt - 1]]
				: [editingSnapshot, rows[editingAt], rows[editingAt - 1]];
		for (const candidate of candidates) {
			const button = editButtonOf(candidate);
			if (button !== undefined) return button;
		}
		return addButton ?? undefined;
	}

	function categoryOf(row: Row) {
		if (row.transfer) return `${row.amount < 0 ? 'To' : 'From'} ${row.transfer.accountName}`;
		if (row.splits) return 'Split';
		return row.categoryName ?? 'Uncategorized';
	}

	function openFromRow(event: MouseEvent, row: Row) {
		if (!(event.target instanceof Element)) return;
		if (event.target.closest('button, a, input, label, [role="checkbox"]')) return;
		if ((getSelection()?.toString() ?? '') !== '') return;
		edit(row);
	}

	function edit(row: Row) {
		deletedId = null;
		editingSnapshot = row;
		editingAt = rows.findIndex((other) => other._id === row._id);
		dialogOpen = true;
	}

	async function toggleCleared(row: Row, cleared: boolean) {
		rowError = '';
		const changed = await attempt(() => setCleared({ transactionId: row._id, cleared }));
		if (!changed.ok) rowError = "Budge couldn't change Cleared. Try again.";
	}

	async function approveRow(row: Row, payee: string) {
		rowError = '';
		undoable = null;
		const at = rows.findIndex((other) => other._id === row._id);
		const waiting = rows.slice(at + 1).filter((other) => !other.approved);
		const approved = await attempt(() => approve({ transactionId: row._id }));
		if (!approved.ok) {
			rowError = "Budge couldn't approve the Transaction. Try again.";
			return;
		}
		announce(`Approved ${payee}`);
		await tick();
		const next = waiting.find((other) => rows.some((shown) => shown._id === other._id));
		const target =
			(next && (shownOf(`[data-approve="${next._id}"]`) ?? editButtonOf(next))) ?? approveAllButton;
		target?.focus();
	}

	let focusFrom: number | null = null;
	function showMore() {
		if (more.status !== 'CanLoadMore') return;
		focusFrom = rows.length;
		more.loadMore(PAGE_SIZE);
	}
	$effect(() => {
		const count = rows.length;
		if (focusFrom === null || count <= focusFrom || more.status === 'LoadingMore') return;
		const firstNew = rows[focusFrom];
		focusFrom = null;
		void tick().then(() => editButtonOf(firstNew)?.focus());
	});

	async function approveEvery() {
		if (approveAllBlocked) return;
		rowError = '';
		approvingAll = true;
		const approvedIn = scopeKey;
		const transactionIds = shownUnapproved;
		const approved = await attempt(() =>
			transactionIds === null ? approveAll(scope) : approveMany({ transactionIds })
		);
		approvingAll = false;
		if (!approved.ok) {
			rowError = "Budge couldn't approve the Transactions. Try again.";
			return;
		}
		undoable = { scopeKey: approvedIn, transactionIds: approved.value };
	}

	function approvedText(count: number) {
		return `Approved ${String(count)} ${count === 1 ? 'Transaction' : 'Transactions'}.`;
	}

	async function undoApproveAll() {
		if (undo === null) return;
		const { transactionIds } = undo;
		undoable = null;
		rowError = '';
		const restored = await attempt(() => unapprove({ transactionIds }));
		if (!restored.ok) rowError = "Budge couldn't undo the approvals. Try again.";
		else announce(`${String(restored.value)} back to Unapproved`);
	}
</script>

{#snippet transactionRow(row: (typeof rows)[number])}
	{@const payee = row.payeeName ?? (row.transfer ? 'Transfer' : 'No Payee')}
	{@const category = categoryOf(row)}
	{@const flag = bankFlag(row)}
	{@const categoryClass =
		row.categoryName === null && !row.transfer && !row.splits ? 'text-warning' : undefined}
	<Table.Row
		weight={row.approved ? 'normal' : 'strong'}
		opens
		onclick={(event: MouseEvent) => {
			openFromRow(event, row);
		}}
	>
		<Table.Cell numeric showFrom="2xl">
			<time datetime={row.date} class="block truncate">{formatDate(row.date)}</time>
		</Table.Cell>
		{#if allAccounts}
			<Table.Cell showFrom="5xl">
				<span class="block truncate">{row.accountName}</span>
			</Table.Cell>
		{/if}
		<Table.Cell>
			<button
				data-edit={row._id}
				aria-label="{payee}, {row.approved ? '' : 'Unapproved, '}edit Transaction on {formatDate(
					row.date
				)}"
				class="block max-w-full rounded-sm text-left hover:underline"
				onclick={() => {
					edit(row);
				}}
			>
				<span
					class={[
						'line-clamp-2 break-words whitespace-normal @4xl:line-clamp-1',
						row.payeeName === null && !row.transfer && 'text-muted-foreground'
					]}
				>
					{payee}
				</span>
			</button>
			{#if flag}
				<span class="block truncate text-xs font-normal text-warning">{flag}</span>
			{/if}
			<span class="flex min-w-0 gap-x-2 text-xs font-normal text-muted-foreground">
				<time datetime={row.date} class="shrink-0 tabular-nums @2xl:hidden">
					{formatDate(row.date, 'short')}
				</time>
				<span class={['min-w-0 truncate @4xl:hidden', categoryClass]}>{category}</span>
			</span>
			{#if allAccounts}
				<span class="block truncate text-xs font-normal text-muted-foreground @5xl:hidden">
					{row.accountName}
				</span>
			{/if}
			{#if row.memo}
				<span
					class={[
						'block truncate text-xs font-normal text-muted-foreground',
						allAccounts ? '@8xl:hidden' : '@6xl:hidden'
					]}
				>
					{row.memo}
				</span>
			{/if}
		</Table.Cell>
		<Table.Cell showFrom="4xl">
			<span class={['block truncate', categoryClass]}>{category}</span>
		</Table.Cell>
		<Table.Cell showFrom={memoFrom}>
			<span class="block truncate">{row.memo ?? ''}</span>
		</Table.Cell>
		<Table.Cell align="end" numeric>
			{formatCents(row.amount)}
			<span
				class={[
					'mt-2 flex items-center justify-end gap-3 pr-1',
					row.approved ? '@lg:hidden' : '@2xl:hidden'
				]}
			>
				{#if !row.approved}
					<Button
						data-approve={row._id}
						size="sm"
						variant="outline"
						onclick={() => approveRow(row, payee)}
						aria-label="Approve {payee}, {formatDate(row.date)}"
					>
						Approve
					</Button>
				{/if}
				<span class="flex @lg:hidden">{@render cleared(row, payee)}</span>
			</span>
		</Table.Cell>
		<Table.Cell align="center" showFrom="lg">
			<span class="flex justify-center">{@render cleared(row, payee)}</span>
		</Table.Cell>
		<Table.Cell showFrom="2xl">
			{#if !row.approved}
				<Button
					data-approve={row._id}
					size="sm"
					variant="outline"
					onclick={() => approveRow(row, payee)}
					aria-label="Approve {payee}, {formatDate(row.date)}"
				>
					Approve
				</Button>
			{/if}
		</Table.Cell>
	</Table.Row>
{/snippet}

{#snippet cleared(row: (typeof rows)[number], payee: string)}
	{#if row.reconciled}
		<LockIcon aria-hidden="true" class="size-4 text-muted-foreground" />
		<span class="sr-only">Reconciled</span>
	{:else}
		<Checkbox
			bind:checked={() => row.cleared, (checked: boolean) => void toggleCleared(row, checked)}
			aria-label="Cleared: {payee}, {formatDate(row.date)}"
		/>
	{/if}
{/snippet}

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center gap-2">
		<Button bind:ref={addButton} onclick={add}>
			<PlusIcon aria-hidden="true" />
			Add Transaction
		</Button>
		<Button variant="outline" onclick={() => (importOpen = true)}>
			<UploadIcon aria-hidden="true" />
			<span>Import <span class="max-sm:sr-only">file</span></span>
		</Button>
	</div>
	<TransactionFilters bind:values={filterValues} showAccount={allAccounts} />
	<p
		role="alert"
		class={problem === ''
			? 'sr-only'
			: 'fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md rounded-md border border-destructive bg-popover px-4 py-3 text-sm text-destructive shadow-lg lg:bottom-6'}
	>
		{problem}
	</p>
	<p role="status" class="sr-only">{announcement}</p>
	<div class="@container">
		<div
			class="flex flex-col items-start gap-2 @md:flex-row @md:items-center @md:justify-between @md:gap-3"
		>
			<p
				aria-live="polite"
				class="flex min-h-6 max-w-full min-w-0 items-center gap-2 text-sm text-muted-foreground"
			>
				{#if undo}
					<span class="truncate">{approvedText(undo.transactionIds.length)}</span>
					<button
						type="button"
						class="relative -my-0.5 min-h-6 shrink-0 rounded-sm px-1 font-medium text-foreground underline underline-offset-4 after:absolute after:-inset-x-2 after:-inset-y-2.5 hover:no-underline"
						onclick={undoApproveAll}>Undo</button
					>
				{:else}
					<span class="truncate">{result}</span>
				{/if}
			</p>
			<Button
				bind:ref={approveAllButton}
				variant="outline"
				aria-disabled={approveAllBlocked}
				onclick={approveEvery}
			>
				<CheckCheckIcon aria-hidden="true" />
				<span class="min-w-36 text-left">{approveAllLabel}</span>
			</Button>
		</div>
	</div>

	<div class="@container">
		<Table.Root layout="fixed">
			<Table.Header labels="lg">
				<Table.Row>
					<Table.Head width="date" showFrom="2xl">Date</Table.Head>
					{#if allAccounts}
						<Table.Head width="name" showFrom="5xl">Account</Table.Head>
					{/if}
					<Table.Head>Payee</Table.Head>
					<Table.Head width="name" showFrom="4xl">Category</Table.Head>
					<Table.Head width="note" showFrom={memoFrom}>Memo</Table.Head>
					<Table.Head width="amount" align="end">Amount</Table.Head>
					<Table.Head width="check" align="center" showFrom="lg">Cleared</Table.Head>
					<Table.Head width="action" showFrom="2xl"
						><span class="sr-only">Approval</span></Table.Head
					>
				</Table.Row>
			</Table.Header>
			{#each groups as group (group.label)}
				<Table.Body>
					{#if group.label !== ''}
						<Table.Row>
							<Table.Cell showFrom="2xl"></Table.Cell>
							{#if allAccounts}
								<Table.Cell showFrom="5xl"></Table.Cell>
							{/if}
							<Table.Head scope="rowgroup">{group.label}</Table.Head>
							<Table.Cell showFrom="4xl"></Table.Cell>
							<Table.Cell showFrom={memoFrom}></Table.Cell>
							<Table.Cell></Table.Cell>
							<Table.Cell showFrom="lg"></Table.Cell>
							<Table.Cell showFrom="2xl"></Table.Cell>
						</Table.Row>
					{/if}
					{#each group.rows as row (row._id)}
						{@render transactionRow(row)}
					{/each}
				</Table.Body>
			{/each}
		</Table.Root>
	</div>
	{#if canShowMore}
		<div>
			<Button variant="outline" aria-disabled={more.status === 'LoadingMore'} onclick={showMore}>
				{more.status === 'LoadingMore' ? 'Loading…' : 'Show more'}
			</Button>
		</div>
	{/if}
</div>

<TransactionDialog
	bind:open={dialogOpen}
	transaction={editing}
	defaultAccountId={accountId}
	{returnFocus}
	ondone={announce}
	ondeleted={(transactionId: Id<'transactions'>) => {
		deletedId = transactionId;
	}}
/>
<ImportDialog bind:open={importOpen} defaultAccountId={accountId} />
