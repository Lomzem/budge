<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import { attempt } from '$lib/attempt';
	import { getBudgetMonth } from '$lib/budget.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatCents } from '$lib/domain/money';

	let {
		categoryId,
		needed,
		label,
		size = 'wrap',
		variant = 'default',
		onassigned
	}: {
		categoryId: Id<'categories'>;
		needed: number;
		label?: string | undefined;
		size?: 'wrap' | 'xs';
		variant?: 'default' | 'outline';
		onassigned: (cents: number) => void;
	} = $props();

	const budget = getBudgetMonth();
	let assigning = $state(false);
	let error = $state('');

	async function assign() {
		error = '';
		assigning = true;
		const assigned = await attempt(() => budget.assignNeeded(categoryId));
		assigning = false;
		if (assigned.ok) onassigned(assigned.value);
		else error = assigned.error?.message ?? "Budge couldn't assign the money. Try again.";
	}
</script>

<Button {size} {variant} aria-label={label} disabled={assigning} onclick={assign}>
	Assign {formatCents(needed)}
</Button>
{#if error}<span role="alert" class="block text-xs whitespace-normal text-destructive">{error}</span
	>{/if}
