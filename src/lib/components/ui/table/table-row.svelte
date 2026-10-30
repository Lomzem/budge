<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	// `strong` sets a row in bold, such as an Unapproved Transaction waiting for review.
	export const tableRowVariants = tv({
		base: 'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
		variants: { weight: { normal: '', strong: 'font-semibold' } },
		defaultVariants: { weight: 'normal' }
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
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLTableRowElement>> & TableRowVariants = $props();
</script>

<tr
	bind:this={ref}
	data-slot="table-row"
	class={cn(tableRowVariants({ weight }), className)}
	{...restProps}
>
	{@render children?.()}
</tr>
