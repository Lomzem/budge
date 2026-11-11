<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import { getBudgetMonth, type BudgetView } from '$lib/budget.svelte';
	import * as Table from '$lib/components/ui/table';
	import { formatCents } from '$lib/domain/money';

	import AssignedInput from './assigned-input.svelte';
	import { availableStatus, waitingNotes } from './status';
	import TargetBar from './target-bar.svelte';

	let {
		groups,
		selectedId,
		onselect
	}: {
		groups: BudgetView['groups'];

		selectedId: Id<'categories'> | null;

		onselect: (id: Id<'categories'>) => void;
	} = $props();

	const budget = getBudgetMonth();
</script>

{#snippet name(category: (typeof groups)[number]['categories'][number])}
	{@const status = availableStatus(category)}
	{@const selected = category.id === selectedId}
	<button
		type="button"
		class="block w-full rounded-sm pl-3 text-left font-medium break-words whitespace-normal underline-offset-4 hover:underline pointer-coarse:py-2"
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
		<div class="mt-1 pl-3">
			<TargetBar
				progress={category.target.progress}
				label="{category.name} Target"
				text={status?.text ?? ''}
			/>
		</div>
	{/if}
	{#if status?.text}
		<span class="block pl-3 text-xs whitespace-normal {status.class}">{status.text}</span>
	{/if}
	{#each waitingNotes(category) as note (note)}
		<span class="hidden pl-3 text-xs whitespace-normal text-muted-foreground sm:block">{note}</span>
	{/each}
{/snippet}

<Table.Root layout="fixed">
	<Table.Header>
		<Table.Row>
			<Table.Head>Category</Table.Head>
			<Table.Head width="amount" align="end" showFrom="screen-xs">Assigned</Table.Head>
			<Table.Head width="amount" align="end" showFrom="screen-sm">Activity</Table.Head>
			<Table.Head width="amount-compact" align="end">Available</Table.Head>
		</Table.Row>
	</Table.Header>
	{#each groups as group (group.id)}
		<Table.Body>
			<Table.Row>
				<Table.Head scope="rowgroup">
					<span class="block font-semibold break-words whitespace-normal">{group.name}</span>
				</Table.Head>
				<Table.Cell align="end" numeric showFrom="screen-xs">
					<span class="font-medium">{formatCents(group.assigned)}</span>
				</Table.Cell>
				<Table.Cell align="end" numeric showFrom="screen-sm">
					<span class="font-medium">{formatCents(group.activity)}</span>
				</Table.Cell>
				<Table.Cell align="end" numeric>
					<span class="font-medium">{formatCents(group.available)}</span>
				</Table.Cell>
			</Table.Row>
			{#each group.categories as category (category.id)}
				{@const status = availableStatus(category)}
				{@const selected = category.id === selectedId}
				<Table.Row data-state={selected ? 'selected' : undefined}>
					<Table.Cell>{@render name(category)}</Table.Cell>
					<Table.Cell align="end" showFrom="screen-xs">
						<AssignedInput
							amount={category.assigned}
							label="Assigned for {category.name}"
							onsave={(cents: number) => budget.setAssigned(category.id, cents)}
						/>
					</Table.Cell>
					<Table.Cell align="end" numeric showFrom="screen-sm">
						{formatCents(category.activity)}
					</Table.Cell>
					<Table.Cell align="end" numeric>
						<span class={['font-medium', status?.class]}>{formatCents(category.available)}</span>
					</Table.Cell>
				</Table.Row>
			{:else}
				<Table.Row>
					<Table.Cell colspan={4}>
						<span class="pl-3 text-muted-foreground">No Categories yet.</span>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	{/each}
</Table.Root>
