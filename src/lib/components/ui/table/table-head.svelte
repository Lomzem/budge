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
		hideFrom,
		numeric,
		variant = 'label',
		...restProps
	}: WithElementRef<Omit<HTMLThAttributes, 'align'>> &
		TableColumnVariants & { variant?: 'label' | 'group' } = $props();
</script>

<th
	bind:this={ref}
	data-slot="table-head"
	class={cn(
		'h-10 px-2 pb-2 text-left align-bottom text-xs font-medium whitespace-nowrap text-muted-foreground sm:px-3',
		variant === 'group' && 'h-auto py-3 align-middle text-sm whitespace-normal',
		tableColumnVariants({ align, width, showFrom, hideFrom, numeric }),
		className
	)}
	{...restProps}
>
	{@render children?.()}
</th>
