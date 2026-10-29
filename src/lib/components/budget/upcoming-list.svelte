<script lang="ts">
	import type { BudgetView } from '$lib/budget.svelte';
	import * as Table from '$lib/components/ui/table';
	import { formatDate } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';

	let { upcoming }: { upcoming: BudgetView['upcoming'] } = $props();
</script>

<section aria-labelledby="upcoming-heading" class="flex flex-col gap-2">
	<h2 id="upcoming-heading" class="font-semibold">Upcoming</h2>
	{#if upcoming.length === 0}
		<p class="text-sm text-muted-foreground">No Targets due in the next 30 days.</p>
	{:else}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head width="fit">Due</Table.Head>
					<Table.Head width="fill">Category</Table.Head>
					<Table.Head width="fit" align="end">Amount</Table.Head>
					<Table.Head width="fit">Funded</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each upcoming as row (row.id)}
					<Table.Row>
						<Table.Cell width="fit">
							<time datetime={row.dueDate}>{formatDate(row.dueDate, 'short')}</time>
						</Table.Cell>
						<Table.Cell width="fill"><span class="block truncate">{row.name}</span></Table.Cell>
						<Table.Cell width="fit" align="end" numeric>{formatCents(row.amount)}</Table.Cell>
						<Table.Cell width="fit">
							<span class={row.funded ? 'text-funded' : 'text-warning'}>
								{row.funded ? 'Yes' : 'No'}
							</span>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	{/if}
</section>
