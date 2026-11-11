<script lang="ts">
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import XIcon from '@lucide/svelte/icons/x';
	import { useQuery } from 'convex-svelte';
	import { MediaQuery } from 'svelte/reactivity';

	import { api } from '$convex/_generated/api';
	import { getAccounts } from '$lib/accounts.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { Choices } from '$lib/components/choices';
	import SelectField from '$lib/components/select-field.svelte';

	import {
		BANK_CHANGES,
		noFilters,
		UNAPPROVED,
		UNCATEGORIZED,
		type TransactionFilterValues
	} from '$lib/transactionFilters';

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
	let filtersOpen = $state(false);
	let searchInput: HTMLInputElement | null = $state(null);

	function categoryChoices(): Choices {
		const data = categories.data;
		return [
			{
				value: '',
				label: categories.error
					? "Categories didn't load. Reload to filter by one."
					: 'Any Category'
			},
			{ value: UNCATEGORIZED, label: 'Uncategorized' },
			...(data?.readyToAssignId ? [{ value: data.readyToAssignId, label: 'Ready to Assign' }] : []),
			...(data?.groups ?? []).map((group) => ({
				group: group.name,
				choices: group.categories.map((category) => ({ value: category._id, label: category.name }))
			}))
		];
	}

	const roomy = new MediaQuery('(min-width: 480px)', true);
</script>

<form
	role="search"
	aria-label="Search and filter Transactions"
	class="@container flex flex-col gap-3"
	onsubmit={(event) => {
		event.preventDefault();
	}}
>
	<div class="flex items-end gap-2">
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<div class="@max-md:sr-only">
				<Label for="transaction-search">Search</Label>
			</div>
			<Input
				id="transaction-search"
				bind:ref={searchInput}
				type="search"
				bind:value={values.search}
				placeholder={roomy.current ? 'Payee or memo' : 'Search'}
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
				<span class="@max-md:sr-only">Filters</span>
				<span class={['text-left', narrowed > 0 ? 'min-w-4' : '@max-md:hidden @md:min-w-4']}
					>{narrowed > 0 ? narrowed : ''}</span
				>
			</Button>
		</div>
		<div class="grid @md:min-w-24">
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
				<span class="@max-md:sr-only">Clear<span class="sr-only"> search and filters</span></span>
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
				<SelectField
					id="transaction-filter-account"
					bind:value={values.accountId}
					choices={[
						{ value: '', label: 'All Accounts' },
						...accounts.all.map((account) => ({ value: account._id, label: account.name }))
					]}
				/>
			</div>
		{/if}
		<div class="flex flex-col gap-1">
			<Label for="transaction-filter-category">Category</Label>
			<SelectField
				id="transaction-filter-category"
				bind:value={values.categoryId}
				choices={categoryChoices()}
			/>
		</div>
		<div class="flex flex-col gap-1">
			<Label for="transaction-filter-status">Status</Label>
			<SelectField
				id="transaction-filter-status"
				bind:value={values.status}
				choices={[
					{ value: '', label: 'Any status' },
					{ value: UNAPPROVED, label: 'Unapproved' },
					{ value: BANK_CHANGES, label: 'Bank changes' }
				]}
			/>
		</div>
		<div class="flex flex-col gap-1">
			<Label for="transaction-filter-payee">Payee</Label>
			<SelectField
				id="transaction-filter-payee"
				bind:value={values.payeeId}
				choices={[
					{
						value: '',
						label: payees.error ? "Payees didn't load. Reload to filter by one." : 'Any Payee'
					},
					...(payees.data ?? []).map((payee) => ({ value: payee._id, label: payee.name }))
				]}
			/>
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
