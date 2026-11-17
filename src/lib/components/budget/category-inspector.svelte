<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import ArrowDownUpIcon from '@lucide/svelte/icons/arrow-down-up';
	import XIcon from '@lucide/svelte/icons/x';
	import { useMutation, useQuery } from 'convex-svelte';
	import { tick } from 'svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { attempt } from '$lib/attempt';
	import { getBudgetMonth, type BudgetView } from '$lib/budget.svelte';
	import CategoryPicker from '$lib/components/category-picker.svelte';
	import DeleteCategoryDialog from '$lib/components/categories/delete-category-dialog.svelte';
	import InlineName from '$lib/components/categories/inline-name.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { formatCents, parseCents } from '$lib/domain/money';

	import AssignNeededButton from './assign-needed-button.svelte';
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

	// svelte-ignore state_referenced_locally
	const openedForId = category.id;

	const list = useQuery(api.categories.list, {});
	const rename = useMutation(api.categories.rename);
	const moveToGroup = useMutation(api.categories.move);
	const setHidden = useMutation(api.categories.setHidden);

	let direction: 'intoThis' | 'outOfThis' = $state('intoThis');
	let otherId = $state('');
	let amount = $state('');
	let moving = $state(false);
	let moveError = $state('');
	let moveInvalid: 'move-category' | 'move-amount' | null = $state(null);
	let covering = $state(false);
	let coverError = $state('');
	let done = $state('');
	let renaming = $state(false);
	let actionError = $state('');
	let actionsTrigger: HTMLElement | null = $state(null);
	let deleteOpen = $state(false);
	let deleteDialog: { reset: () => void } | undefined = $state();
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
				categories: option.categories.filter((c) => c.id !== openedForId)
			}))
			.filter((option) => option.categories.length > 0)
	);

	const status = $derived(availableStatus(category));

	const managedGroups = $derived(list.data?.groups ?? []);
	const ownGroup = $derived(
		managedGroups.find((group) => group.categories.some((c) => c._id === openedForId))
	);
	const otherLabel = $derived(direction === 'intoThis' ? 'From' : 'To');

	const breakdown = $derived([
		{ label: 'Left over from last month', cents: category.priorAvailable, assigned: false },
		{ label: 'Assigned this month', cents: category.assigned, assigned: true },
		{ label: 'Activity', cents: category.activity, assigned: false }
	]);

	function findOther(id: string) {
		return others.flatMap((group) => group.categories).find((c) => c.id === id);
	}

	const moveDirty = $derived(otherId !== '' || amount !== '' || moveError !== '');

	function clearMove() {
		otherId = '';
		amount = '';
		moveError = '';
		moveInvalid = null;
		document.getElementById('move-category')?.focus();
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
		done = '';
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
		const self = { id: openedForId, name: category.name };
		const sent = {
			from: direction === 'outOfThis' ? self : other,
			to: direction === 'outOfThis' ? other : self,
			cents,
			amount
		};
		moving = true;
		const moved = await attempt(() => budget.moveMoney(sent.from.id, sent.to.id, sent.cents));
		moving = false;
		if (moved.ok) {
			if (amount === sent.amount) amount = '';
			done = `Moved ${formatCents(sent.cents)} from ${sent.from.name} to ${sent.to.name}.`;
		} else moveError = moved.error?.message ?? "Budge couldn't move the money. Try again.";
	}

	async function cover() {
		coverError = '';
		done = '';
		const name = category.name;
		covering = true;
		const covered = await attempt(() => budget.cover(openedForId));
		covering = false;
		if (!covered.ok) {
			coverError = covered.error?.message ?? "Budge couldn't cover the Category. Try again.";
			return;
		}
		done = `Covered ${formatCents(covered.value)} for ${name} from Ready to Assign.`;
		section?.focus({ preventScroll: true });
	}

	async function coverFromCategory() {
		direction = 'intoThis';
		amount = formatCents(-category.available);
		moveError = '';
		moveInvalid = null;
		await tick();
		const picker = document.getElementById('move-category');
		picker?.scrollIntoView({ block: 'nearest' });
		picker?.focus();
	}

	function swap() {
		direction = direction === 'intoThis' ? 'outOfThis' : 'intoThis';
	}

	async function act(change: () => Promise<unknown>): Promise<boolean> {
		actionError = '';
		const changed = await attempt(change);
		if (!changed.ok) actionError = changed.error?.message ?? "Budge couldn't save that. Try again.";
		return changed.ok;
	}

	function hide() {
		void act(() => setHidden({ categoryId: openedForId, hidden: true }));
	}

	function editTarget() {
		targetDialog?.reset();
		targetOpen = true;
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !event.defaultPrevented) onclose();
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
		<InlineName
			name={category.name}
			label="Category name"
			bind:editing={renaming}
			onsave={(name: string) => rename({ categoryId: openedForId, name })}
			onleave={() => {
				actionsTrigger?.focus();
			}}
		>
			{#snippet children(name: string)}
				<h2 id="inspector-heading" class="min-w-0 flex-1 text-lg font-bold break-words">{name}</h2>
			{/snippet}
		</InlineName>
		<div class="flex shrink-0 items-center">
			{#if ownGroup}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="{category.name} actions"
								{...props}
								bind:ref={actionsTrigger}
							>
								<EllipsisIcon aria-hidden="true" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content
						align="end"
						onCloseAutoFocus={(event: Event) => {
							if (renaming) event.preventDefault();
						}}
					>
						<DropdownMenu.Item
							onSelect={() => {
								renaming = true;
							}}
						>
							Rename
						</DropdownMenu.Item>
						{#if managedGroups.length > 1}
							<DropdownMenu.Sub>
								<DropdownMenu.SubTrigger>Move to group</DropdownMenu.SubTrigger>
								<DropdownMenu.SubContent>
									{#each managedGroups.filter((g) => g._id !== ownGroup._id) as other (other._id)}
										<DropdownMenu.Item
											onSelect={() =>
												void act(() =>
													moveToGroup({
														categoryId: openedForId,
														groupId: other._id,
														index: other.categories.length
													})
												)}
										>
											{other.name}
										</DropdownMenu.Item>
									{/each}
								</DropdownMenu.SubContent>
							</DropdownMenu.Sub>
						{/if}
						<DropdownMenu.Item onSelect={hide}>Hide from budget</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item
							variant="destructive"
							onSelect={() => {
								deleteDialog?.reset();
								deleteOpen = true;
							}}
						>
							Delete…
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
			<Button variant="ghost" size="icon-sm" aria-label="Close {category.name}" onclick={onclose}>
				<XIcon />
			</Button>
		</div>
	</div>
	{#if actionError}<p role="alert" class="-mt-2 text-sm text-destructive">{actionError}</p>{/if}

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
							onsave={(cents: number) => budget.setAssigned(openedForId, cents)}
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
			<Button size="wrap" variant="outline" onclick={() => void coverFromCategory()}>
				Cover from another Category
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
			{#if category.payment.uncovered > 0}
				<AssignNeededButton
					categoryId={openedForId}
					needed={category.payment.uncovered}
					onassigned={() => {
						section?.focus({ preventScroll: true });
					}}
				/>
			{/if}
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
					<AssignNeededButton
						categoryId={openedForId}
						needed={category.target.needed}
						onassigned={() => {
							section?.focus({ preventScroll: true });
						}}
					/>
				{/if}
			{/if}
			<Button variant="outline" size="sm" onclick={editTarget}>
				{category.target ? 'Edit Target' : 'Add Target'}
			</Button>
		</section>
	{/if}

	<p role="status" class="sr-only">{done}</p>

	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<form
		class="flex flex-col gap-3"
		aria-labelledby="move-heading"
		novalidate
		onsubmit={move}
		onkeydown={(event) => {
			if (event.key !== 'Escape' || event.defaultPrevented || !moveDirty) return;
			event.preventDefault();
			clearMove();
		}}
	>
		<h3 id="move-heading" class="text-sm font-medium">Move money</h3>
		{#snippet self(side: string)}
			<div class="flex min-w-0 flex-col gap-2">
				<span class="text-sm font-medium" id="move-{side}">{side}</span>
				<p
					aria-labelledby="move-{side}"
					class="flex min-h-9 items-center rounded-md border border-dashed px-3 text-sm break-words"
				>
					{category.name}
				</p>
			</div>
		{/snippet}
		{#snippet other()}
			<div class="flex min-w-0 flex-col gap-2">
				<Label for="move-category">{otherLabel}</Label>
				<CategoryPicker
					id="move-category"
					required
					aria-invalid={moveInvalid === 'move-category' ? true : undefined}
					aria-describedby={moveInvalid === 'move-category' ? 'move-error' : undefined}
					bind:value={otherId}
					placeholder="Pick a Category"
					onValueChange={() => {
						if (moveInvalid === 'move-category') {
							moveInvalid = null;
							moveError = '';
						}
						void tick().then(() => document.getElementById('move-amount')?.focus());
					}}
					choices={others.map((group) => ({
						group: group.label,
						choices: group.categories.map((other) => ({
							value: other.id,
							label: `${other.name} (${formatCents(other.available)})`
						}))
					}))}
				/>
			</div>
		{/snippet}
		<div class="flex flex-col gap-1">
			{#if direction === 'intoThis'}
				{@render other()}
			{:else}
				{@render self('From')}
			{/if}
			<div class="flex justify-center">
				<Button variant="ghost" size="sm" onclick={swap}>
					<ArrowDownUpIcon aria-hidden="true" />
					Swap From and To
				</Button>
			</div>
			{#if direction === 'intoThis'}
				{@render self('To')}
			{:else}
				{@render other()}
			{/if}
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
				{#if moveDirty}
					<Button type="button" variant="ghost" onclick={clearMove}>Clear</Button>
				{/if}
			</div>
		</div>
		<p id="move-error" class="-mt-1 min-h-5 text-sm text-destructive">
			{#if moveError}<span role="alert">{moveError}</span>{/if}
		</p>
	</form>
</section>

<DeleteCategoryDialog
	bind:this={deleteDialog}
	bind:open={deleteOpen}
	category={{ id: openedForId, name: category.name }}
	groups={managedGroups}
/>

<TargetDialog
	bind:this={targetDialog}
	bind:open={targetOpen}
	category={{ id: openedForId, name: category.name, target: category.target?.definition ?? null }}
/>
