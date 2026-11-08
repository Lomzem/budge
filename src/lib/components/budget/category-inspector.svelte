<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';

	import type { Id } from '$convex/_generated/dataModel';
	import { attempt } from '$lib/attempt';
	import { getBudgetMonth, type BudgetView } from '$lib/budget.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { formatCents, parseCents } from '$lib/domain/money';

	import AssignedInput from './assigned-input.svelte';
	import { availableStatus, describeTarget, paymentNotes } from './status';
	import TargetBar from './target-bar.svelte';
	import TargetDialog from './target-dialog.svelte';

	type CategoryBudget = BudgetView['groups'][number]['categories'][number];

	let {
		category,
		view,
		editAssigned = false,
		readyToAssign,
		onclose
	}: {
		category: CategoryBudget;

		view: BudgetView;

		editAssigned?: boolean;

		readyToAssign?: number | undefined;
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
		{ label: 'Left over from last month', cents: category.priorAvailable, assigned: false },
		{ label: 'Assigned this month', cents: category.assigned, assigned: true },
		{ label: 'Activity', cents: category.activity, assigned: false }
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
		const moved = await attempt(() =>
			direction === 'to'
				? budget.moveMoney(category.id, other, cents)
				: budget.moveMoney(other, category.id, cents)
		);
		moving = false;
		if (moved.ok) amount = '';
		else moveError = moved.error?.message ?? "Budge couldn't move the money. Try again.";
	}

	async function cover() {
		coverError = '';
		covering = true;
		const covered = await attempt(() => budget.cover(category.id));
		covering = false;
		if (!covered.ok) {
			coverError = covered.error?.message ?? "Budge couldn't cover the Category. Try again.";
			return;
		}
		section?.focus({ preventScroll: true });
	}

	async function assignTarget() {
		assignError = '';
		assigning = true;
		const assigned = await attempt(() => budget.assignTarget(category.id));
		assigning = false;
		if (!assigned.ok) {
			assignError = assigned.error?.message ?? "Budge couldn't assign the money. Try again.";
			return;
		}
		section?.focus({ preventScroll: true });
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

	{#if readyToAssign !== undefined}
		<p
			class={[
				'-mt-2 flex justify-between gap-4 rounded-md px-3 py-1.5 text-sm',
				readyToAssign < 0 ? 'bg-destructive-tint' : 'bg-funded-tint'
			]}
		>
			<span>Ready to Assign</span>
			<span
				class={[
					'font-bold whitespace-nowrap tabular-nums',
					readyToAssign < 0 ? 'text-destructive' : 'text-funded'
				]}>{formatCents(readyToAssign)}</span
			>
		</p>
	{/if}

	<dl class="flex flex-col gap-1 text-sm">
		{#each breakdown as row (row.label)}
			{#if editAssigned && row.assigned}
				<div class="flex items-center justify-between gap-4">
					<dt class="min-w-0 text-muted-foreground">{row.label}</dt>
					<dd>
						<AssignedInput
							amount={row.cents}
							label={row.label}
							onsave={(cents: number) => budget.setAssigned(category.id, cents)}
						/>
					</dd>
				</div>
			{:else}
				<div class="flex justify-between gap-4">
					<dt class="min-w-0 text-muted-foreground">{row.label}</dt>
					<dd class="whitespace-nowrap tabular-nums">{formatCents(row.cents)}</dd>
				</div>
			{/if}
		{/each}
		<div class="flex justify-between gap-4 border-t pt-1 font-medium">
			<dt>Available</dt>
			<dd class={['text-right tabular-nums', status?.class]}>
				<span class="whitespace-nowrap">{formatCents(category.available)}</span>

				{#if status && !category.target && !category.payment}
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
			<p role="alert" class="min-h-6 text-sm text-destructive">{coverError}</p>
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
				<p role="alert" class="min-h-6 text-sm text-destructive">{assignError}</p>
			{:else}
				<p class="text-sm text-muted-foreground">No Target yet.</p>
			{/if}
			<Button variant="outline" size="sm" onclick={editTarget}>
				{category.target ? 'Edit Target' : 'Add Target'}
			</Button>
		</section>
	{/if}

	<form class="flex flex-col gap-3" aria-labelledby="move-heading" novalidate onsubmit={move}>
		<h3 id="move-heading" class="text-sm font-medium">Move money</h3>
		<fieldset>
			<legend class="sr-only">Direction</legend>
			<RadioGroup.Root bind:value={direction} orientation="horizontal">
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
				class="h-9 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-base md:text-sm pointer-coarse:h-11"
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
			<div class="flex gap-2">
				<Input
					id="move-amount"
					bind:value={amount}
					inputmode="decimal"
					placeholder="0.00"
					autocomplete="off"
					required
				/>
				<Button type="submit" variant="outline" disabled={moving}>Move</Button>
			</div>
		</div>
		<p role="alert" class="-mt-1 min-h-5 text-sm text-destructive">{moveError}</p>
	</form>
</section>

<TargetDialog
	bind:this={targetDialog}
	bind:open={targetOpen}
	category={{ id: category.id, name: category.name, target: category.target?.definition ?? null }}
/>
