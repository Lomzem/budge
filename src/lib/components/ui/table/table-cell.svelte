<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLTdAttributes } from 'svelte/elements';

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
	}: WithElementRef<Omit<HTMLTdAttributes, 'align'>> & TableColumnVariants = $props();
</script>

<td
	bind:this={ref}
	data-slot="table-cell"
	class={cn(
		'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0',
		tableColumnVariants({ align, width, showFrom, numeric }),
		className
	)}
	{...restProps}
>
	{@render children?.()}
</td>
