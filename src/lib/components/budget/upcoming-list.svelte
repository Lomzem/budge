<script lang="ts">
	import type { BudgetView } from '$lib/budget.svelte';
	import { formatDate, monthOf } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';

	let { upcoming, today }: { upcoming: BudgetView['upcoming']; today: string } = $props();
</script>

{#if upcoming.length > 0}
	<section aria-labelledby="upcoming-heading" class="flex flex-col gap-2">
		<h2 id="upcoming-heading" class="font-semibold">Upcoming</h2>
		<ul class="flex flex-col divide-y text-sm">
			{#each upcoming as row (row.id)}
				{@const short = !row.funded && monthOf(row.dueDate) === monthOf(today)}
				<li class="flex items-baseline gap-3 py-2">
					<time datetime={row.dueDate} class="w-12 shrink-0 text-muted-foreground tabular-nums"
						>{formatDate(row.dueDate, 'day')}</time
					>
					<span class="min-w-0 flex-1">
						<span class="block truncate">{row.name}</span>
						{#if short}
							<span class="block text-xs text-warning">Not funded</span>
						{/if}
					</span>
					<span class="shrink-0 tabular-nums">{formatCents(row.amount)}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}
