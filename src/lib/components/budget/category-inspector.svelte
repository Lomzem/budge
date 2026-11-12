<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import XIcon from '@lucide/svelte/icons/x';

	import type { Id } from '$convex/_generated/dataModel';
	import { attempt } from '$lib/attempt';
	import { getBudgetMonth, type BudgetView } from '$lib/budget.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import SelectField from '$lib/components/select-field.svelte';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { formatCents, parseCents } from '$lib/domain/money';

	import AssignedInput from './assigned-input.svelte';
	import { availableStatus, describeTarget, paymentNotes } from './status';
	import TargetBar from './target-bar.svelte';
	import TargetDialog from './target-dialog.svelte';

	type CategoryBudget = BudgetView['groups'][number]['categories'][number];
	type Step = { id: Id<'categories'>; name: string } | undefined;

	let {
		category,
		view,
		editAssigned = false,
		readyToAssign,
		steps,
		onstep,
		onclose
	}: {
		category: CategoryBudget;

		view: BudgetView;

		editAssigned?: boolean;

		readyToAssign?: number | undefined;

		steps?: { previous: Step; next: Step } | undefined;
		onstep?: (id: Id<'categories'>) => void;
		onclose: () => void;
	} = $props();

	const budget = getBudgetMonth();

	let direction: 'to' | 'from' = $state('to');
	let otherId = $state('');
	let amount = $state('');
	let moving = $state(false);
	let moveError = $state('');
	let moveInvalid: 'move-category' | 'move-amount' | null = $state(null);
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

	function refuseMove(control: 'move-category' | 'move-amount', message: string) {
		moveInvalid = control;
		moveError = message;
		document.getElementById(control)?.focus();
	}

	async function move(event: SubmitEvent) {
		event.preventDefault();
		moveError = '';
		moveInvalid = null;
		const other = findOther(otherId);
		const cents = parseCents(amount);
		if (other === undefined) {
			refuseMove('move-category', 'Pick a Category.');
			return;
		}
		if (cents === undefined || cents <= 0) {
			refuseMove('move-amount', 'Enter an amount above zero, such as 25.00.');
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
	<div
		class={[
			'flex items-start justify-between gap-2',
			editAssigned &&
				'sticky -top-5 z-10 -mx-5 -mt-5 border-b bg-popover px-5 pt-5 pb-3 sm:-top-6 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6'
		]}
	>
		<h2 id="inspector-heading" class="min-w-0 text-lg font-bold break-words">{category.name}</h2>
		<Button variant="ghost" size="icon-sm" aria-label="Close {category.name}" onclick={onclose}>
			<XIcon />
		</Button>
	</div>

	{#if readyToAssign !== undefined}
		<p
			class={[
				'-mt-2 flex flex-wrap justify-between gap-x-2 rounded-md px-3 py-1.5 text-sm',
				readyToAssign < 0 ? 'bg-destructive-tint' : 'bg-funded-tint'
			]}
		>
			<span class="whitespace-nowrap">Ready to Assign</span>
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

				{#if status?.text && !category.target && !category.payment}
					<span class="block text-xs">{status.text}</span>
				{/if}
			</dd>
		</div>
	</dl>

	{#if steps}
		<nav aria-label="Other Categories" class="-mt-1 grid grid-cols-2 gap-2">
			{#each [steps.previous, steps.next] as step, index (index)}
				{#if step}
					<Button
						variant="outline"
						size="wrap"
						aria-label="{index === 0 ? 'Previous' : 'Next'} Category: {step.name}"
						onclick={() => onstep?.(step.id)}
					>
						{#if index === 0}<ChevronLeftIcon aria-hidden="true" />{/if}
						<span class="min-w-0 truncate">{step.name}</span>
						{#if index === 1}<ChevronRightIcon aria-hidden="true" />{/if}
					</Button>
				{:else}
					<span></span>
				{/if}
			{/each}
		</nav>
	{/if}

	{#if category.available < 0}
		<div class="flex flex-col gap-1">
			<Button size="wrap" disabled={covering} onclick={cover}>
				Cover {formatCents(-category.available)} from Ready to Assign
			</Button>
			<p class="min-h-6 text-sm text-destructive">
				{#if coverError}<span role="alert">{coverError}</span>{/if}
			</p>
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
				<p class="min-h-6 text-sm text-destructive">
					{#if assignError}<span role="alert">{assignError}</span>{/if}
				</p>
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
			<SelectField
				id="move-category"
				required
				aria-invalid={moveInvalid === 'move-category' ? true : undefined}
				aria-describedby={moveInvalid === 'move-category' ? 'move-error' : undefined}
				bind:value={otherId}
				placeholder="Pick a Category"
				choices={others.map((group) => ({
					group: group.label,
					choices: group.categories.map((other) => ({
						value: other.id,
						label: `${other.name} (${formatCents(other.available)})`
					}))
				}))}
			/>
		</div>
		<div class="flex flex-col gap-2">
			<Label for="move-amount">Amount</Label>
			<div class="flex gap-2">
				<Input
					id="move-amount"
					bind:value={amount}
					aria-invalid={moveInvalid === 'move-amount' ? true : undefined}
					aria-describedby={moveInvalid === 'move-amount' ? 'move-error' : undefined}
					inputmode="decimal"
					placeholder="0.00"
					autocomplete="off"
					required
				/>
				<Button type="submit" variant="outline" disabled={moving}>Move</Button>
			</div>
		</div>
		<p id="move-error" class="-mt-1 min-h-5 text-sm text-destructive">
			{#if moveError}<span role="alert">{moveError}</span>{/if}
		</p>
	</form>
</section>

<TargetDialog
	bind:this={targetDialog}
	bind:open={targetOpen}
	category={{ id: category.id, name: category.name, target: category.target?.definition ?? null }}
/>
