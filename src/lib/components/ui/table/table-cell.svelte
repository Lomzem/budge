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
		hideFrom,
		numeric,
		...restProps
	}: WithElementRef<Omit<HTMLTdAttributes, 'align'>> & TableColumnVariants = $props();
</script>

<td
	bind:this={ref}
	data-slot="table-cell"
	class={cn(
		'px-2 py-2 align-middle whitespace-nowrap sm:px-3',
		tableColumnVariants({ align, width, showFrom, hideFrom, numeric }),
		className
	)}
	{...restProps}
>
	{@render children?.()}
</td>
