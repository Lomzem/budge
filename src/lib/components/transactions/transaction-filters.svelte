<script lang="ts">
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import XIcon from '@lucide/svelte/icons/x';
	import { tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	import { getShellQueries } from '$lib/shellQueries.svelte';
	import { getAccounts } from '$lib/accounts.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import CategoryPicker from '$lib/components/category-picker.svelte';
	import type { Choices } from '$lib/components/choices';
	import SelectField from '$lib/components/select-field.svelte';
	import { formatDate, localToday } from '$lib/domain/dates';
	import {
		BANK_CHANGES,
		dateRangeOf,
		dateRanges,
		noFilters,
		UNAPPROVED,
		UNCATEGORIZED,
		withDateRange,
		type TransactionFilterValues
	} from '$lib/transactionFilters';

	import { labelOf } from './categoryChoices';

	let {
		values = $bindable({ ...noFilters }),
		showAccount
	}: {
		values?: TransactionFilterValues;

		showAccount: boolean;
	} = $props();

	const accounts = getAccounts();
	const { categories, payees } = getShellQueries();
	const active = $derived(Object.values(values).some((value) => value !== ''));
	let filtersOpen = $state(false);
	let searchInput: HTMLInputElement | null = $state(null);
	let filtersToggle: HTMLButtonElement | null = $state(null);
	let chipList: HTMLElement | null = $state(null);

	const statusChoices: Choices = [
		{ value: '', label: 'Any status' },
		{ value: UNAPPROVED, label: 'Unapproved' },
		{ value: BANK_CHANGES, label: 'Bank changes' }
	];

	function payeeChoices(): Choices {
		return [
			{
				value: '',
				label: payees.error ? "Payees didn't load. Reload to filter by one." : 'Any Payee'
			},
			...(payees.data ?? []).map((payee) => ({ value: payee._id, label: payee.name }))
		];
	}

	const dateRange = $derived(dateRangeOf(values, localToday()));

	function dateChoices(): Choices {
		return [
			{ value: '', label: 'Any dates' },
			...dateRanges,
			...(dateRange === 'custom' ? [{ value: 'custom', label: 'Custom dates' }] : [])
		];
	}

	function datesLabel() {
		const preset = dateRanges.find((range) => range.value === dateRange);
		if (preset) return preset.label;
		if (values.to === '') return `From ${formatDate(values.from)}`;
		if (values.from === '') return `Until ${formatDate(values.to)}`;
		return `${formatDate(values.from)} – ${formatDate(values.to)}`;
	}

	interface Chip {
		readonly key: string;
		readonly label: string;
		readonly cleared: Partial<TransactionFilterValues>;
	}

	const chips: Chip[] = $derived.by(() => {
		const named = (key: keyof TransactionFilterValues, label: string, choices: Choices) =>
			values[key] === ''
				? []
				: [
						{
							key,
							label: `${label}: ${labelOf(choices, values[key]) ?? '…'}`,
							cleared: { [key]: '' }
						}
					];
		return [
			...(showAccount
				? named(
						'accountId',
						'Account',
						accounts.all.map((account) => ({ value: account._id, label: account.name }))
					)
				: []),
			...named('categoryId', 'Category', categoryChoices()),
			...named('status', 'Status', statusChoices),
			...named('payeeId', 'Payee', payeeChoices()),
			...(dateRange === ''
				? []
				: [{ key: 'dates', label: `Dates: ${datesLabel()}`, cleared: { from: '', to: '' } }])
		];
	});
	const narrowed = $derived(chips.length);

	async function removeChip(chip: Chip, index: number) {
		values = { ...values, ...chip.cleared };
		await tick();
		const left = [...(chipList?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
		(left[Math.min(index, left.length - 1)] ?? filtersToggle)?.focus();
	}

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
				bind:ref={filtersToggle}
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
	{#if chips.length > 0}
		<ul
			bind:this={chipList}
			aria-label="Active filters"
			class={['flex flex-wrap gap-2 @3xl:hidden', filtersOpen && 'hidden']}
		>
			{#each chips as chip, index (chip.key)}
				<li class="flex max-w-full min-w-0">
					<button
						type="button"
						class="inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-medium text-secondary-foreground transition-colors select-none hover:bg-secondary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:h-11"
						onclick={() => removeChip(chip, index)}
					>
						<span class="min-w-0 truncate"><span class="sr-only">Remove </span>{chip.label}</span>
						<XIcon aria-hidden="true" class="size-4 shrink-0" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	<div
		id="transaction-filter-fields"
		class={[
			'grid-cols-2 gap-3 @3xl:grid',
			showAccount ? '@3xl:grid-cols-4 @6xl:grid-cols-7' : '@3xl:grid-cols-3 @5xl:grid-cols-6',
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
			<CategoryPicker
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
				choices={statusChoices}
			/>
		</div>
		<div class="flex flex-col gap-1">
			<Label for="transaction-filter-payee">Payee</Label>
			<CategoryPicker
				id="transaction-filter-payee"
				searchLabel="Search Payees"
				bind:value={values.payeeId}
				choices={payeeChoices()}
			/>
		</div>
		<div class="flex flex-col gap-1">
			<Label for="transaction-filter-dates">Dates</Label>
			<SelectField
				id="transaction-filter-dates"
				bind:value={
					() => dateRange,
					(range: string) => {
						if (range === 'custom') return;
						const preset = dateRanges.find((choice) => choice.value === range);
						values = withDateRange(values, preset?.value ?? '', localToday());
					}
				}
				choices={dateChoices()}
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
