<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	export const tableRowVariants = tv({
		base: 'border-b border-border transition-colors hover:bg-muted/60 has-aria-expanded:bg-muted/60 data-[state=selected]:bg-funded-tint',
		variants: {
			weight: {
				normal: '',
				strong: 'bg-muted/40 font-bold',
				group: 'bg-muted/40 hover:bg-muted/40 has-aria-expanded:bg-muted/40'
			},
			opens: { true: 'cursor-pointer', false: '' },
			holds: {
				true: 'pointer-coarse:touch-callout-none pointer-coarse:select-none pointer-coarse:[&_input]:select-text pointer-coarse:[&_input]:touch-callout-default',
				false: ''
			}
		},
		defaultVariants: { weight: 'normal', opens: false, holds: false }
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
		opens,
		holds,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLTableRowElement>> & TableRowVariants = $props();
</script>

<tr
	bind:this={ref}
	data-slot="table-row"
	class={cn(tableRowVariants({ weight, opens, holds }), className)}
	{...restProps}
>
	{@render children?.()}
</tr>
