<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert-dialog-footer"
	class={cn(
		'-mx-5 -mb-5 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 px-5 py-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
