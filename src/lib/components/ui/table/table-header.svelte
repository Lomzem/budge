<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		labels = 'always',
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLTableSectionElement>> & {
		labels?: 'always' | 'lg';
	} = $props();
</script>

<thead
	bind:this={ref}
	data-slot="table-header"
	class={cn('[&_tr]:border-b', labels === 'lg' && '@max-lg:sr-only', className)}
	{...restProps}
>
	{@render children?.()}
</thead>
