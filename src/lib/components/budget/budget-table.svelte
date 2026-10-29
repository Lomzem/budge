<script lang="ts">
	import { getBudgetMonth, type BudgetView } from '$lib/budget.svelte';
	import * as Table from '$lib/components/ui/table';
	import type { AvailableStatus } from '$lib/domain/budget';
	import { formatCents } from '$lib/domain/money';

	import AssignedInput from './assigned-input.svelte';

	let { groups }: { groups: BudgetView['groups'] } = $props();

	const budget = getBudgetMonth();

	// Color is never the only signal: every colored amount has its status in words beside it.
	const STATUS: Record<AvailableStatus, { text: string; class: string } | undefined> = {
		funded: { text: 'Funded', class: 'text-funded' },
		underfunded: { text: 'Underfunded', class: 'text-warning' },
		overspent: { text: 'Overspent', class: 'text-destructive' },
		empty: undefined
	};
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
				{@const status = STATUS[category.status]}
				<Table.Row>
					<Table.Cell width="fill">
						<span class="block truncate pl-3">{category.name}</span>
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
						{#if status}
							<span class="block text-xs {status.class}">{status.text}</span>
						{/if}
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
