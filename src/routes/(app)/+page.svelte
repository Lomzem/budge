<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	import { resolve } from '$app/paths';
	import { getAccounts } from '$lib/accounts.svelte';
	import { getBudgetMonth } from '$lib/budget.svelte';
	import AccountDialog from '$lib/components/accounts/account-dialog.svelte';
	import AddCategoryDialog from '$lib/components/budget/add-category-dialog.svelte';
	import BudgetTable from '$lib/components/budget/budget-table.svelte';
	import CutoverDate from '$lib/components/settings/cutover-date.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatMonth } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';

	const accounts = getAccounts();
	const budget = getBudgetMonth();
	let addAccountOpen = $state(false);
	let adding: 'group' | 'category' | undefined = $state();
	let addingOpen = $state(false);
	/** Bumped on each open, so the dialog mounts fresh with an empty form. */
	let addingSession = $state(0);

	const view = $derived(budget.view);
	const readyToAssign = $derived(budget.readyToAssign);
	const groups = $derived(view?.groups.map((group) => ({ id: group.id, name: group.name })) ?? []);

	function add(kind: 'group' | 'category') {
		adding = kind;
		addingSession += 1;
		addingOpen = true;
	}
</script>

<svelte:head>
	<title>Budget · Budge</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-semibold">Budget</h1>
			<div class="flex items-center gap-1">
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Previous month"
					disabled={!budget.canGoBack}
					onclick={() => {
						budget.previous();
					}}
				>
					<ChevronLeftIcon />
				</Button>
				<p aria-live="polite" class="min-w-36 text-center font-medium">
					{formatMonth(budget.month)}
				</p>
				<Button
					variant="ghost"
					size="icon-sm"
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
			<div class="ml-auto text-right">
				<p class="text-sm text-muted-foreground">Ready to Assign</p>
				<p
					data-testid="ready-to-assign"
					class={[
						'text-2xl font-semibold tabular-nums',
						readyToAssign.amount < 0 && 'text-destructive'
					]}
				>
					{formatCents(readyToAssign.amount)}
				</p>
				{#if readyToAssign.uncategorized !== 0}
					<p class="text-xs text-muted-foreground tabular-nums">
						includes {formatCents(readyToAssign.uncategorized)} Uncategorized
					</p>
				{/if}
			</div>
		{/if}
	</header>

	<CutoverDate />

	{#if accounts.loaded && accounts.all.length === 0}
		<section class="flex flex-col items-start gap-2">
			<p class="text-muted-foreground">Nothing to budget yet. Add an Account to get started.</p>
			<Button onclick={() => (addAccountOpen = true)}>Add Account</Button>
		</section>
	{/if}

	{#if budget.error}
		<p role="alert" class="text-sm text-destructive">
			Budge couldn't load the budget. Try reloading the page.
		</p>
	{:else if !view}
		<p role="status" class="text-muted-foreground">Loading…</p>
	{:else}
		{#if readyToAssign && readyToAssign.amount < 0}
			<p role="status" class="font-medium text-destructive">
				Ready to Assign is negative: you've assigned {formatCents(-readyToAssign.amount)} more than you
				have. Lower an Assigned amount.
			</p>
		{/if}
		{#if view.uncategorizedCount > 0}
			<p class="text-sm">
				<a href={resolve('/accounts')} class="underline underline-offset-4 hover:no-underline">
					{view.uncategorizedCount}
					{view.uncategorizedCount === 1 ? 'Transaction needs' : 'Transactions need'} a Category
				</a>
			</p>
		{/if}
		{#if view.overspent.length > 0}
			<section aria-labelledby="overspent-heading" class="flex flex-col gap-1">
				<h2 id="overspent-heading" class="font-medium">Overspent</h2>
				<ul class="flex flex-col gap-0.5 text-sm">
					{#each view.overspent as category (category.id)}
						<li class="flex max-w-sm justify-between gap-4">
							<span>{category.name}</span>
							<span class="text-destructive tabular-nums">
								Overspent by {formatCents(-category.available)}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section aria-label="Categories" class="flex flex-col gap-3">
			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={() => {
						add('group');
					}}
				>
					Add Category Group
				</Button>
				{#if groups.length > 0}
					<Button
						variant="outline"
						size="sm"
						onclick={() => {
							add('category');
						}}>Add Category</Button
					>
				{/if}
			</div>
			{#if groups.length > 0}
				<BudgetTable groups={view.groups} />
			{:else}
				<p class="text-muted-foreground">
					No Categories yet. Add a Category Group, then Categories to assign money to.
				</p>
			{/if}
		</section>
	{/if}
</div>

<AccountDialog bind:open={addAccountOpen} />
{#if adding}
	{#key addingSession}
		<AddCategoryDialog bind:open={addingOpen} kind={adding} {groups} />
	{/key}
{/if}
