<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';

	import type { Id } from '$convex/_generated/dataModel';
	import { getBudgetMonth, type BudgetView } from '$lib/budget.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { formatCents, parseCents } from '$lib/domain/money';
	import { readPublicError } from '$lib/publicError';

	import { availableStatus, describeTarget, paymentNotes } from './status';
	import TargetBar from './target-bar.svelte';
	import TargetDialog from './target-dialog.svelte';

	type CategoryBudget = BudgetView['groups'][number]['categories'][number];

	let {
		category,
		view,
		onclose
	}: {
		/** The selected Category. Key the inspector by its ID, so a new selection starts fresh. */
		category: CategoryBudget;
		/** The month's budget, for the Categories money can move to or from. */
		view: BudgetView;
		onclose: () => void;
	} = $props();

	const budget = getBudgetMonth();

	let direction: 'to' | 'from' = $state('to');
	let otherId = $state('');
	let amount = $state('');
	let moving = $state(false);
	let moveError = $state('');
	let covering = $state(false);
	let coverError = $state('');
	let assigning = $state(false);
	let assignError = $state('');
	let targetOpen = $state(false);
	let targetDialog: { reset: () => void } | undefined = $state();
	let section: HTMLElement | undefined = $state();

	// Every other Category money can move to or from, by group, with hidden ones last.
	const others = $derived(
		[
			...view.groups.map((group) => ({
				key: group.id,
				label: group.name,
				categories: group.categories
			})),
			{ key: 'hidden', label: 'Hidden', categories: view.hidden }
		]
			.map((option) => ({
				...option,
				categories: option.categories.filter((c) => c.id !== category.id)
			}))
			.filter((option) => option.categories.length > 0)
	);

	const status = $derived(availableStatus(category));

	const breakdown = $derived([
		{ label: 'Left over from last month', cents: category.priorAvailable },
		{ label: 'Assigned this month', cents: category.assigned },
		{ label: 'Activity', cents: category.activity }
	]);

	function findOther(id: string): Id<'categories'> | undefined {
		return others.flatMap((group) => group.categories).find((c) => c.id === id)?.id;
	}

	async function move(event: SubmitEvent) {
		event.preventDefault();
		moveError = '';
		const other = findOther(otherId);
		const cents = parseCents(amount);
		if (other === undefined) {
			moveError = 'Pick a Category.';
			return;
		}
		if (cents === undefined || cents <= 0) {
			moveError = 'Enter an amount above zero, such as 25.00.';
			return;
		}
		moving = true;
		try {
			if (direction === 'to') await budget.moveMoney(category.id, other, cents);
			else await budget.moveMoney(other, category.id, cents);
			amount = '';
		} catch (thrown) {
			moveError = readPublicError(thrown)?.message ?? "Budge couldn't move the money. Try again.";
		} finally {
			moving = false;
		}
	}

	async function cover() {
		coverError = '';
		covering = true;
		try {
			await budget.cover(category.id);
			// The Cover button goes once Available reaches zero, so keep keyboard focus in the inspector.
			section?.focus();
		} catch (thrown) {
			coverError =
				readPublicError(thrown)?.message ?? "Budge couldn't cover the Category. Try again.";
		} finally {
			covering = false;
		}
	}

	async function assignTarget() {
		assignError = '';
		assigning = true;
		try {
			await budget.assignTarget(category.id);
			// The Assign button goes once the Target is funded, so keep keyboard focus in the inspector.
			section?.focus();
		} catch (thrown) {
			assignError =
				readPublicError(thrown)?.message ?? "Budge couldn't assign the money. Try again.";
		} finally {
			assigning = false;
		}
	}

	function editTarget() {
		targetDialog?.reset();
		targetOpen = true;
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onclose();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
	bind:this={section}
	id="category-inspector"
	aria-labelledby="inspector-heading"
	tabindex="-1"
	class="flex flex-col gap-4 outline-none"
	onkeydown={keydown}
>
	<div class="flex items-start justify-between gap-2">
		<h2 id="inspector-heading" class="min-w-0 font-semibold break-words">{category.name}</h2>
		<Button variant="ghost" size="icon-sm" aria-label="Close {category.name}" onclick={onclose}>
			<XIcon />
		</Button>
	</div>

	<dl class="flex flex-col gap-1 text-sm">
		{#each breakdown as row (row.label)}
			<div class="flex justify-between gap-4">
				<dt class="text-muted-foreground">{row.label}</dt>
				<dd class="tabular-nums">{formatCents(row.cents)}</dd>
			</div>
		{/each}
		<div class="flex justify-between gap-4 border-t pt-1 font-medium">
			<dt>Available</dt>
			<dd class={['text-right tabular-nums', status?.class]}>
				{formatCents(category.available)}
				<!-- With a Target, its section below gives the status. -->
				{#if status && !category.target}
					<span class="block text-xs">{status.text}</span>
				{/if}
			</dd>
		</div>
	</dl>

	{#if category.available < 0}
		<div class="flex flex-col gap-1">
			<Button size="wrap" disabled={covering} onclick={cover}>
				Cover {formatCents(-category.available)} from Ready to Assign
			</Button>
			{#if coverError}
				<p role="alert" class="text-sm text-destructive">{coverError}</p>
			{/if}
		</div>
	{/if}

	{#if category.payment}
		<section aria-labelledby="payment-heading" class="flex flex-col gap-2">
			<h3 id="payment-heading" class="text-sm font-medium">Card payment</h3>
			{#each paymentNotes(category) as note (note)}
				<p class="text-sm">{note}</p>
			{:else}
				<p class="text-sm text-muted-foreground">Available covers the card's debt.</p>
			{/each}
		</section>
	{:else}
		<section aria-labelledby="target-heading" class="flex flex-col gap-2">
			<h3 id="target-heading" class="text-sm font-medium">Target</h3>
			{#if category.target}
				<p class="text-sm">{describeTarget(category.target)}</p>
				<TargetBar
					progress={category.target.progress}
					label="{category.name} Target"
					text={status?.text ?? ''}
				/>
				{#if status}
					<p class={['text-sm', status.class]}>{status.text}</p>
				{/if}
				{#if category.target.needed > 0}
					<Button size="wrap" disabled={assigning} onclick={assignTarget}>
						Assign {formatCents(category.target.needed)}
					</Button>
				{/if}
				{#if assignError}
					<p role="alert" class="text-sm text-destructive">{assignError}</p>
				{/if}
			{:else}
				<p class="text-sm text-muted-foreground">No Target yet.</p>
			{/if}
			<Button variant="outline" size="sm" onclick={editTarget}>
				{category.target ? 'Edit Target' : 'Add Target'}
			</Button>
		</section>
	{/if}

	<form class="flex flex-col gap-3" aria-labelledby="move-heading" onsubmit={move}>
		<h3 id="move-heading" class="text-sm font-medium">Move money</h3>
		<fieldset>
			<legend class="sr-only">Direction</legend>
			<RadioGroup.Root bind:value={direction}>
				<div class="flex items-center gap-2">
					<RadioGroup.Item value="to" id="move-to" />
					<Label for="move-to">Move to</Label>
				</div>
				<div class="flex items-center gap-2">
					<RadioGroup.Item value="from" id="move-from" />
					<Label for="move-from">Take from</Label>
				</div>
			</RadioGroup.Root>
		</fieldset>
		<div class="flex flex-col gap-2">
			<Label for="move-category">{direction === 'to' ? 'To Category' : 'From Category'}</Label>
			<select
				id="move-category"
				bind:value={otherId}
				required
				class="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm"
			>
				<option value="" disabled>Pick a Category</option>
				{#each others as group (group.key)}
					<optgroup label={group.label}>
						{#each group.categories as other (other.id)}
							<option value={other.id}>{other.name} ({formatCents(other.available)})</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</div>
		<div class="flex flex-col gap-2">
			<Label for="move-amount">Amount</Label>
			<Input
				id="move-amount"
				bind:value={amount}
				inputmode="decimal"
				placeholder="0.00"
				autocomplete="off"
				required
			/>
		</div>
		{#if moveError}
			<p role="alert" class="text-sm text-destructive">{moveError}</p>
		{/if}
		<Button type="submit" variant="outline" disabled={moving}>Move money</Button>
	</form>
</section>

<TargetDialog
	bind:this={targetDialog}
	bind:open={targetOpen}
	category={{ id: category.id, name: category.name, target: category.target?.definition ?? null }}
/>
