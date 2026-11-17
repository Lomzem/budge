<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';

	import type { Id } from '$convex/_generated/dataModel';
	import { getBudgetMonth, type BudgetView } from '$lib/budget.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import { neededOf } from '$lib/domain/budget';
	import { formatCents } from '$lib/domain/money';

	import AssignNeededButton from './assign-needed-button.svelte';
	import AssignedInput from './assigned-input.svelte';
	import { availableStatus, waitingNotes } from './status';
	import TargetBar from './target-bar.svelte';

	type Group = BudgetView['groups'][number];
	type CategoryBudget = Group['categories'][number];

	let {
		groups,
		selectedId,
		collapsed,
		onselect,
		ontoggle,
		onadd
	}: {
		groups: BudgetView['groups'];

		selectedId: Id<'categories'> | null;

		collapsed: ReadonlySet<Id<'categoryGroups'>>;

		onselect: (id: Id<'categories'>) => void;

		ontoggle: (id: Id<'categoryGroups'>) => void;

		onadd: (group: { id: Id<'categoryGroups'>; name: string }) => void;
	} = $props();

	const budget = getBudgetMonth();

	function focusName(id: Id<'categories'>) {
		[...document.querySelectorAll<HTMLElement>(`[data-category-id="${id}"]`)]
			.find((button) => button.checkVisibility())
			?.focus();
	}
</script>

{#snippet name(category: CategoryBudget)}
	{@const status = availableStatus(category)}
	{@const selected = category.id === selectedId}
	{@const needed = neededOf(category)}
	<button
		type="button"
		class="block w-full rounded-sm text-left font-medium break-words whitespace-normal underline-offset-4 hover:underline xs:pl-3 pointer-coarse:py-2"
		aria-expanded={selected}
		aria-controls={selected ? 'category-inspector' : undefined}
		data-category-id={category.id}
		onclick={() => {
			onselect(category.id);
		}}
	>
		{category.name}
	</button>
	{#if category.target}
		<div class="mt-1 xs:pl-3">
			<TargetBar
				progress={category.target.progress}
				label="{category.name} Target"
				text={status?.text ?? ''}
			/>
		</div>
	{/if}
	{#if status?.text}
		<span class="block text-xs whitespace-normal xs:pl-3 {status.class}">{status.text}</span>
	{/if}
	{#if needed > 0}
		<div class="mt-1 xs:pl-3">
			<AssignNeededButton
				categoryId={category.id}
				{needed}
				label="Assign {formatCents(needed)} to {category.name}"
				size="xs"
				variant="outline"
				onassigned={() => {
					focusName(category.id);
				}}
			/>
		</div>
	{/if}
	{#each waitingNotes(category) as note (note)}
		<span class="hidden pl-3 text-xs whitespace-normal text-muted-foreground sm:block">{note}</span>
	{/each}
{/snippet}

{#snippet stackedAvailable(cents: number, tone: string)}
	<span class="mt-1 block text-xs font-medium tabular-nums @md:hidden {tone}"
		><span class="sr-only">Available </span>{formatCents(cents)}</span
	>
{/snippet}

<div class="@container">
	<Table.Root layout="fixed">
		<Table.Header>
			<Table.Row>
				<Table.Head>Category</Table.Head>
				<Table.Head width="assigned" align="end">
					Assigned
					<span class="block @md:hidden">Available</span>
				</Table.Head>
				<Table.Head width="amount" align="end" showFrom="xl">Activity</Table.Head>
				<Table.Head width="amount" align="end" showFrom="md">Available</Table.Head>
			</Table.Row>
		</Table.Header>
		{#each groups as group (group.id)}
			{@const shut = collapsed.has(group.id)}
			{@const overspent = group.categories.filter((c) => c.status === 'overspent').length}
			<Table.Body>
				<Table.Row weight="group">
					<Table.Head scope="rowgroup" variant="group">
						<div class="flex items-start gap-1">
							<button
								type="button"
								class="flex min-w-0 flex-1 items-start gap-1 rounded-sm text-left text-foreground pointer-coarse:py-2"
								aria-expanded={!shut}
								onclick={() => {
									ontoggle(group.id);
								}}
							>
								<ChevronRightIcon
									aria-hidden="true"
									class={[
										'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
										!shut && 'rotate-90'
									]}
								/>
								<span class="min-w-0">
									<span class="block text-sm font-semibold break-words whitespace-normal"
										>{group.name}</span
									>
									{#if shut && overspent > 0}
										<span class="block text-xs font-medium whitespace-normal text-destructive">
											{overspent} overspent
										</span>
									{/if}
								</span>
							</button>
							{#if group.kind === 'normal'}
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label="Add Category to {group.name}"
									onclick={() => {
										onadd({ id: group.id, name: group.name });
									}}
								>
									<PlusIcon />
								</Button>
							{/if}
						</div>
					</Table.Head>
					<Table.Cell align="end" numeric>
						<span class="font-medium">{formatCents(group.assigned)}</span>
						{@render stackedAvailable(
							group.available,
							group.available < 0 ? 'text-destructive' : ''
						)}
					</Table.Cell>
					<Table.Cell align="end" numeric showFrom="xl">
						<span class="font-medium">{formatCents(group.activity)}</span>
					</Table.Cell>
					<Table.Cell align="end" numeric showFrom="md">
						<span class={['font-medium', group.available < 0 && 'text-destructive']}
							>{formatCents(group.available)}</span
						>
					</Table.Cell>
				</Table.Row>
				{#if !shut}
					{#each group.categories as category (category.id)}
						{@const status = availableStatus(category)}
						{@const selected = category.id === selectedId}
						<Table.Row data-state={selected ? 'selected' : undefined}>
							<Table.Cell>{@render name(category)}</Table.Cell>
							<Table.Cell align="end">
								<AssignedInput
									amount={category.assigned}
									label="Assigned for {category.name}"
									onsave={(cents: number) => budget.setAssigned(category.id, cents)}
								/>
								{@render stackedAvailable(category.available, status?.class ?? '')}
							</Table.Cell>
							<Table.Cell align="end" numeric showFrom="xl">
								{formatCents(category.activity)}
							</Table.Cell>
							<Table.Cell align="end" numeric showFrom="md">
								<span class={['font-medium', status?.class]}>{formatCents(category.available)}</span
								>
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={4}>
								<span class="pl-3 text-muted-foreground">No Categories yet.</span>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		{/each}
	</Table.Root>
</div>
