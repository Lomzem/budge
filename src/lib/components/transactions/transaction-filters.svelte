<script lang="ts">
	import { useQuery } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import { getAccounts } from '$lib/accounts.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	import { noFilters, type TransactionFilterValues } from './filters';

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

	const selectClass =
		'h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm';
</script>

<form
	role="search"
	aria-label="Search and filter Transactions"
	class="@container"
	onsubmit={(event) => {
		event.preventDefault();
	}}
>
	<div class="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
		<div class="flex flex-col gap-1 @md:col-span-2 @3xl:col-span-3">
			<Label for="transaction-search">Search</Label>
			<Input
				id="transaction-search"
				type="search"
				bind:value={values.search}
				placeholder="Payee, memo, or bank description"
				autocomplete="off"
			/>
		</div>
		{#if showAccount}
			<div class="flex flex-col gap-1">
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
				<option value="">Any Category</option>
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
			<Label for="transaction-filter-payee">Payee</Label>
			<select id="transaction-filter-payee" bind:value={values.payeeId} class={selectClass}>
				<option value="">Any Payee</option>
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
	{#if active}
		<div class="mt-3">
			<Button
				type="button"
				variant="outline"
				size="sm"
				onclick={() => {
					values = { ...noFilters };
				}}
			>
				Clear search and filters
			</Button>
		</div>
	{/if}
	{#if categories.error ?? payees.error}
		<p role="alert" class="mt-2 text-sm text-destructive">
			Budge couldn't load every filter. Try reloading the page.
		</p>
	{/if}
</form>
