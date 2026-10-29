<script lang="ts">
	import { Progress as ProgressPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		max = 100,
		value = null,
		...restProps
	}: WithoutChildrenOrChild<ProgressPrimitive.RootProps> = $props();

	// Typed apart from the spread: svelte-check can't represent the union of every root prop.
	const rootProps: ProgressPrimitive.RootProps = $derived({ ...restProps, value, max });
</script>

<ProgressPrimitive.Root
	bind:ref
	data-slot="progress"
	class={cn(
		'relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted',
		className
	)}
	{...rootProps}
>
	<div
		data-slot="progress-indicator"
		class="size-full flex-1 bg-primary transition-all"
		style="transform: translateX(-{100 - (100 * (value ?? 0)) / (max ?? 1)}%)"
	></div>
</ProgressPrimitive.Root>
