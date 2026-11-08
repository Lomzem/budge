<script lang="ts">
	import type { HTMLTableAttributes } from 'svelte/elements';

	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		layout = 'auto',
		children,
		...restProps
	}: WithElementRef<HTMLTableAttributes> & { layout?: 'auto' | 'fixed' } = $props();
</script>

<div data-slot="table-container" class="relative w-full overflow-x-auto">
	<table
		bind:this={ref}
		data-slot="table"
		class={cn('w-full caption-bottom text-sm', layout === 'fixed' && 'table-fixed', className)}
		{...restProps}
	>
		{@render children?.()}
	</table>
</div>
