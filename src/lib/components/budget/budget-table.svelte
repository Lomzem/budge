<script lang="ts">
	import type { Snippet } from 'svelte';

	import type { Id } from '$convex/_generated/dataModel';
	import { getBudgetMonth, type BudgetView } from '$lib/budget.svelte';
	import * as Table from '$lib/components/ui/table';
	import { formatCents } from '$lib/domain/money';

	import AssignedInput from './assigned-input.svelte';
	import { availableStatus } from './status';
	import TargetBar from './target-bar.svelte';

	let {
		groups,
		selectedId,
		onselect,
		inline
	}: {
		groups: BudgetView['groups'];
		/** The Category the inspector shows, if any. */
		selectedId: Id<'categories'> | null;
		/** Selects a Category, or clears the selection when it is already selected. */
		onselect: (id: Id<'categories'>) => void;
		/** The inspector, shown in a row under the selected Category on narrow screens. */
		inline?: Snippet | undefined;
	} = $props();

	const budget = getBudgetMonth();
</script>

<Table.Root>
	<Table.Header>
		<Table.Row>
			<Table.Head width="fill">Category</Table.Head>
			<Table.Head width="fit" align="end">Assigned</Table.Head>
			<Table.Head width="fit" align="end" showFrom="screen-sm">Activity</Table.Head>
			<Table.Head width="fit" align="end">Available</Table.Head>
		</Table.Row>
	</Table.Header>
	{#each groups as group (group.id)}
		<Table.Body>
			<Table.Row>
				<Table.Head scope="rowgroup" width="fill">
					<span class="font-semibold">{group.name}</span>
				</Table.Head>
				<Table.Cell align="end" numeric>
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
					<Table.Cell width="fill">
						<button
							type="button"
							class="block w-full truncate rounded-sm pl-3 text-left underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
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
						{#if status}
							<span class="block truncate pl-3 text-xs {status.class}">{status.text}</span>
						{/if}
					</Table.Cell>
					<Table.Cell align="end">
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
						<span class={status?.class}>{formatCents(category.available)}</span>
					</Table.Cell>
				</Table.Row>
				{#if selected && inline}
					<Table.Row>
						<Table.Cell colspan={4}>
							<div class="px-1 py-2 whitespace-normal">{@render inline()}</div>
						</Table.Cell>
					</Table.Row>
				{/if}
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
