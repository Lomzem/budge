<script lang="ts">
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import XIcon from '@lucide/svelte/icons/x';
	import { useQuery } from 'convex-svelte';
	import { untrack } from 'svelte';

	import { api } from '$convex/_generated/api';
	import { getAccounts } from '$lib/accounts.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	import {
		BANK_CHANGES,
		noFilters,
		UNAPPROVED,
		UNCATEGORIZED,
		type TransactionFilterValues
	} from './filters';

	let {
		values = $bindable({ ...noFilters }),
		showAccount
	}: {
		values?: TransactionFilterValues;

		showAccount: boolean;
	} = $props();

	const accounts = getAccounts();
	const categories = useQuery(api.categories.list, {});
	const payees = useQuery(api.payees.list, {});
	const active = $derived(Object.values(values).some((value) => value !== ''));
	const narrowed = $derived(
		Object.entries(values).filter(([key, value]) => key !== 'search' && value !== '').length
	);
	let filtersOpen = $state(untrack(() => narrowed > 0));
	let searchInput: HTMLInputElement | null = $state(null);

	const selectClass =
		'h-9 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-base pointer-coarse:h-11';
</script>

<form
	role="search"
	aria-label="Search and filter Transactions"
	class="@container flex flex-col gap-3"
	onsubmit={(event) => {
		event.preventDefault();
	}}
>
	<div class="flex flex-wrap items-end gap-2">
		<div class="flex w-full min-w-0 flex-col gap-1 @lg:w-auto @lg:flex-1">
			<Label for="transaction-search">Search</Label>
			<Input
				id="transaction-search"
				bind:ref={searchInput}
				type="search"
				bind:value={values.search}
				placeholder="Payee, memo, or bank description"
				autocomplete="off"
			/>
		</div>
		<div class="@3xl:hidden">
			<Button
				type="button"
				variant="outline"
				aria-expanded={filtersOpen}
				aria-controls="transaction-filter-fields"
				onclick={() => (filtersOpen = !filtersOpen)}
			>
				<SlidersHorizontalIcon aria-hidden="true" />
				Filters
				<span class="min-w-4 text-left">{narrowed > 0 ? narrowed : ''}</span>
			</Button>
		</div>
		<div class="grid min-w-24">
			<Button
				type="button"
				variant="ghost"
				disabled={!active}
				onclick={() => {
					values = { ...noFilters };
					searchInput?.focus();
				}}
			>
				<XIcon aria-hidden="true" />
				Clear<span class="sr-only"> search and filters</span>
			</Button>
		</div>
	</div>
	<div
		id="transaction-filter-fields"
		class={[
			'grid-cols-2 gap-3 @3xl:grid',
			showAccount ? '@3xl:grid-cols-6' : '@3xl:grid-cols-5',
			filtersOpen ? 'grid' : 'hidden'
		]}
	>
		{#if showAccount}
			<div class="col-span-2 flex flex-col gap-1 @3xl:col-span-1">
				<Label for="transaction-filter-account">Account</Label>
				<select id="transaction-filter-account" bind:value={values.accountId} class={selectClass}>
					<option value="">All Accounts</option>
					{#each accounts.all as account (account._id)}
						<option value={account._id}>{account.name}</option>
					{/each}
				</select>
			</div>
		{/if}
		<div class="flex flex-col gap-1">
			<Label for="transaction-filter-category">Category</Label>
			<select id="transaction-filter-category" bind:value={values.categoryId} class={selectClass}>
				<option value="">
					{categories.error ? "Categories didn't load. Reload to filter by one." : 'Any Category'}
				</option>
				<option value={UNCATEGORIZED}>Uncategorized</option>
				{#if categories.data}
					{#if categories.data.readyToAssignId !== null}
						<option value={categories.data.readyToAssignId}>Ready to Assign</option>
					{/if}
					{#each categories.data.groups as group (group._id)}
						<optgroup label={group.name}>
							{#each group.categories as category (category._id)}
								<option value={category._id}>{category.name}</option>
							{/each}
						</optgroup>
					{/each}
				{/if}
			</select>
		</div>
		<div class="flex flex-col gap-1">
			<Label for="transaction-filter-status">Status</Label>
			<select id="transaction-filter-status" bind:value={values.status} class={selectClass}>
				<option value="">Any status</option>
				<option value={UNAPPROVED}>Unapproved</option>
				<option value={BANK_CHANGES}>Bank changes</option>
			</select>
		</div>
		<div class="flex flex-col gap-1">
			<Label for="transaction-filter-payee">Payee</Label>
			<select id="transaction-filter-payee" bind:value={values.payeeId} class={selectClass}>
				<option value="">
					{payees.error ? "Payees didn't load. Reload to filter by one." : 'Any Payee'}
				</option>
				{#each payees.data ?? [] as payee (payee._id)}
					<option value={payee._id}>{payee.name}</option>
				{/each}
			</select>
		</div>
		<div class="flex flex-col gap-1">
			<Label for="transaction-filter-from">From</Label>
			<Input id="transaction-filter-from" type="date" bind:value={values.from} />
		</div>
		<div class="flex flex-col gap-1">
			<Label for="transaction-filter-to">To</Label>
			<Input id="transaction-filter-to" type="date" bind:value={values.to} />
		</div>
	</div>
</form>
