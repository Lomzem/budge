<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLThAttributes } from 'svelte/elements';

	import { type TableColumnVariants, tableColumnVariants } from './table-variants.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		align,
		width,
		showFrom,
		numeric,
		...restProps
	}: WithElementRef<Omit<HTMLThAttributes, 'align'>> & TableColumnVariants = $props();
</script>

<th
	bind:this={ref}
	data-slot="table-head"
	class={cn(
		'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0',
		tableColumnVariants({ align, width, showFrom, numeric }),
		className
	)}
	{...restProps}
>
	{@render children?.()}
</th>
