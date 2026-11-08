<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	export const tableRowVariants = tv({
		base: 'border-b border-border transition-colors hover:bg-muted/60 has-aria-expanded:bg-muted/60 data-[state=selected]:bg-funded-tint',
		variants: {
			weight: { normal: '', strong: 'bg-muted/40 font-bold' },
			part: { whole: '', phoneLead: 'border-b-0 sm:hidden' }
		},
		defaultVariants: { weight: 'normal', part: 'whole' }
	});

	export type TableRowVariants = VariantProps<typeof tableRowVariants>;
</script>

<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		weight,
		part,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLTableRowElement>> & TableRowVariants = $props();
</script>

<tr
	bind:this={ref}
	data-slot="table-row"
	class={cn(tableRowVariants({ weight, part }), className)}
	{...restProps}
>
	{@render children?.()}
</tr>
