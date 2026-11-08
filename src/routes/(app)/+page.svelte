<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { useQuery } from 'convex-svelte';
	import { tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	import { resolve } from '$app/paths';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getAccounts } from '$lib/accounts.svelte';
	import { getBankConnections } from '$lib/bankConnections.svelte';
	import { getBudgetMonth } from '$lib/budget.svelte';
	import AccountDialog from '$lib/components/accounts/account-dialog.svelte';
	import AddCategoryDialog from '$lib/components/budget/add-category-dialog.svelte';
	import BudgetTable from '$lib/components/budget/budget-table.svelte';
	import CategoryInspector from '$lib/components/budget/category-inspector.svelte';
	import UpcomingList from '$lib/components/budget/upcoming-list.svelte';
	import CutoverDate from '$lib/components/settings/cutover-date.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatMonth } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';
	import { formatUnapprovedCount } from '$lib/domain/unapproved';

	const accounts = getAccounts();
	const bank = getBankConnections();
	const budget = getBudgetMonth();
	const settings = useQuery(api.settings.get, {});
	const unapproved = useQuery(api.transactions.unapprovedCount, {});
	const unapprovedCount = $derived(unapproved.data ?? 0);
	let addAccountOpen = $state(false);
	let cutoverUnsetOnArrival = $state(false);

	$effect(() => {
		if (settings.data?.cutoverDate === null) cutoverUnsetOnArrival = true;
	});
	let adding: 'group' | 'category' = $state('group');
	let addingOpen = $state(false);

	let addDialog: { reset: () => void; saving: () => boolean } | undefined = $state();

	const view = $derived(budget.shown);
	const readyToAssign = $derived(budget.readyToAssign);
	const ready = $derived(
		view !== undefined && settings.data !== undefined && unapproved.data !== undefined
	);
	const groupsACategoryCanJoin = $derived(
		view?.groups
			.filter((group) => group.kind === 'normal')
			.map((group) => ({ id: group.id, name: group.name })) ?? []
	);

	const wide = new MediaQuery('(min-width: 1024px)');
	let selectedId: Id<'categories'> | null = $state(null);

	const selected = $derived(
		view?.groups.flatMap((group) => group.categories).find((c) => c.id === selectedId)
	);

	interface Need {
		text: string;
		href?: '/accounts' | '/bank';
		tone: 'bad' | 'warn';
	}

	const needs = $derived.by((): Need[] => {
		if (view === undefined) return [];
		const list: Need[] = [];
		if (readyToAssign && readyToAssign.amount < 0) {
			list.push({
				text: `Assigned ${formatCents(-readyToAssign.amount)} more than you have`,
				tone: 'bad'
			});
		}
		if (view.overspent.length > 0) {
			const count = view.overspent.length;
			list.push({
				text: `${String(count)} ${count === 1 ? 'Category' : 'Categories'} overspent`,
				tone: 'bad'
			});
		}
		if (view.uncategorizedCount > 0) {
			const count = view.uncategorizedCount;
			list.push({
				text: `${String(count)} ${count === 1 ? 'Transaction needs' : 'Transactions need'} a Category`,
				href: '/accounts',
				tone: 'warn'
			});
		}
		if (unapprovedCount > 0) {
			list.push({
				text: `${formatUnapprovedCount(unapprovedCount)} Unapproved`,
				href: '/accounts',
				tone: 'warn'
			});
		}
		if (bank.needingYou > 0) {
			list.push({
				text: `Bank: ${String(bank.needingYou)} ${bank.needingYou === 1 ? 'thing needs' : 'things need'} you`,
				href: '/bank',
				tone: 'warn'
			});
		}
		return list;
	});

	async function select(id: Id<'categories'>) {
		selectedId = selectedId === id ? null : id;
		if (selectedId !== null && wide.current) {
			await tick();
			document.getElementById('category-inspector')?.focus();
		}
	}

	async function closeInspector() {
		const id = selectedId;
		selectedId = null;
		await tick();
		if (id !== null) {
			document.querySelector<HTMLElement>(`[data-category-id="${id}"]`)?.focus();
		}
	}

	function add(kind: 'group' | 'category') {
		adding = kind;
		addDialog?.reset();
		addingOpen = true;
	}
</script>

<svelte:head>
	<title>Budget · Budge</title>
</svelte:head>

{#if budget.error}
	<p role="alert" class="text-destructive">
		Budge couldn't load the budget. Try reloading the page.
	</p>
{:else if !ready || view === undefined}
	<p role="status" class="text-muted-foreground">Loading…</p>
{:else}
	<div class="flex flex-col gap-6">
		<header class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
			<div class="flex flex-col gap-1">
				<h1 class="text-2xl font-bold tracking-tight">Budget</h1>
				<div class="-ml-2 flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						aria-label="Previous month"
						disabled={!budget.canGoBack}
						onclick={() => {
							budget.previous();
						}}
					>
						<ChevronLeftIcon />
					</Button>
					<p aria-live="polite" class="min-w-40 text-center text-lg font-bold">
						{formatMonth(budget.month)}
					</p>
					<Button
						variant="ghost"
						size="icon"
						aria-label="Next month"
						onclick={() => {
							budget.next();
						}}
					>
						<ChevronRightIcon />
					</Button>
				</div>
			</div>
			{#if readyToAssign}
				<div
					class={[
						'flex min-w-56 flex-col items-end rounded-lg px-5 py-3',
						readyToAssign.amount < 0 ? 'bg-destructive-tint' : 'bg-funded-tint'
					]}
				>
					<p class="text-sm font-bold">Ready to Assign</p>
					<p
						data-testid="ready-to-assign"
						class={[
							'border-b-4 border-double border-current text-3xl font-bold',
							readyToAssign.amount < 0 ? 'text-destructive' : 'text-funded'
						]}
					>
						{formatCents(readyToAssign.amount)}
					</p>
					<p class="mt-1 min-h-5 text-xs">
						{#if readyToAssign.uncategorized !== 0}
							includes {formatCents(readyToAssign.uncategorized)} Uncategorized
						{/if}
					</p>
				</div>
			{/if}
		</header>

		{#if cutoverUnsetOnArrival}
			<div class="max-w-2xl rounded-lg border bg-card p-5 sm:p-6">
				<CutoverDate />
			</div>
		{/if}

		<section aria-label="Needs you" class="-my-1 flex h-10 items-center">
			{#if needs.length === 0}
				<p class="flex items-center gap-2 text-muted-foreground">
					<CircleCheckIcon aria-hidden="true" class="size-5 text-funded" />
					Nothing needs you right now.
				</p>
			{:else}
				<ul class="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-1">
					{#each needs as need (need.text)}
						{@const tone =
							need.tone === 'bad'
								? 'bg-destructive-tint text-destructive'
								: 'bg-warning-tint text-warning'}
						<li class="shrink-0">
							{#if need.href}
								<a
									href={resolve(need.href)}
									class={[
										'flex h-8 items-center rounded-full px-3 text-sm font-bold whitespace-nowrap underline-offset-4 hover:underline',
										tone
									]}
								>
									{need.text}
								</a>
							{:else}
								<span
									class={[
										'flex h-8 items-center rounded-full px-3 text-sm font-bold whitespace-nowrap',
										tone
									]}
								>
									{need.text}
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if accounts.all.length === 0 && settings.data?.cutoverDate !== null}
			<section
				class="flex max-w-2xl flex-col items-start gap-3 rounded-lg border border-dashed border-input p-6"
			>
				<p class="font-bold">Nothing to budget yet</p>
				<p class="text-muted-foreground">
					Add an Account with its current balance, or connect a bank from the <a
						href={resolve('/bank')}
						class="underline underline-offset-4 hover:no-underline">Bank</a
					> page.
				</p>
				<Button onclick={() => (addAccountOpen = true)}>
					<PlusIcon aria-hidden="true" />
					Add Account
				</Button>
			</section>
		{/if}

		<section aria-label="Categories" class="flex flex-col gap-3">
			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={addDialog?.saving() === true && adding !== 'group'}
					onclick={() => {
						add('group');
					}}
				>
					<PlusIcon aria-hidden="true" />
					Add Category Group
				</Button>
				{#if groupsACategoryCanJoin.length > 0}
					<Button
						variant="outline"
						size="sm"
						disabled={addDialog?.saving() === true && adding !== 'category'}
						onclick={() => {
							add('category');
						}}
					>
						<PlusIcon aria-hidden="true" />
						Add Category
					</Button>
				{/if}
				<Button variant="ghost" size="sm" href={resolve('/categories')}>Manage Categories</Button>
			</div>
			{#if view.groups.length > 0}
				<div class="lg:flex lg:items-start lg:gap-8" aria-busy={budget.stale}>
					<div class={['min-w-0 flex-1', budget.stale && 'opacity-60']} inert={budget.stale}>
						<BudgetTable
							groups={view.groups}
							selectedId={selected?.id ?? null}
							onselect={select}
							inline={selected && !wide.current ? inspector : undefined}
						/>
					</div>
					{#if wide.current}
						<aside class="sticky top-8 flex w-80 shrink-0 flex-col gap-6">
							{#if selected}
								<div class="rounded-lg border bg-card p-5">{@render inspector()}</div>
							{/if}
							<UpcomingList upcoming={view.upcoming} />
						</aside>
					{/if}
				</div>
				{#if !wide.current}
					<UpcomingList upcoming={view.upcoming} />
				{/if}
			{:else if view.hidden.length === 0}
				<p class="text-muted-foreground">
					No Categories yet. Add a Category Group, then Categories to assign money to.
				</p>
			{:else if view.upcoming.length > 0}
				<UpcomingList upcoming={view.upcoming} />
			{/if}
		</section>

		{#if view.overspent.length > 0}
			<section aria-labelledby="overspent-heading" class="flex flex-col gap-2">
				<h2 id="overspent-heading" class="text-lg font-bold">Overspent</h2>
				<ul class="flex max-w-md flex-col divide-y rounded-lg border bg-card">
					{#each view.overspent as category (category.id)}
						<li class="flex justify-between gap-4 px-4 py-2">
							<span class="truncate">{category.name}</span>
							<span class="shrink-0 text-destructive">
								Overspent by {formatCents(-category.available)}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if view.hidden.length > 0}
			<section aria-labelledby="hidden-heading" class="flex flex-col gap-2">
				<h2 id="hidden-heading" class="text-lg font-bold">Hidden Categories</h2>
				<ul class="flex max-w-md flex-col divide-y rounded-lg border bg-card">
					{#each view.hidden as category (category.id)}
						<li class="flex justify-between gap-4 px-4 py-2">
							<span class="truncate">{category.name}</span>
							<span class="shrink-0">
								<span class="sr-only">Available</span>
								{formatCents(category.available)}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
{/if}

{#snippet inspector()}
	{#if view && selected}
		{#key selected.id}
			<CategoryInspector category={selected} {view} onclose={closeInspector} />
		{/key}
	{/if}
{/snippet}

<AccountDialog bind:open={addAccountOpen} />
<AddCategoryDialog
	bind:this={addDialog}
	bind:open={addingOpen}
	kind={adding}
	groups={groupsACategoryCanJoin}
/>
