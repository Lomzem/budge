<script lang="ts">
	import { Command as CommandPrimitive, ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
	import { cn, type WithoutChild } from '$lib/utils.js';
	import Scrollbar from '../scroll-area/scroll-area-scrollbar.svelte';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithoutChild<CommandPrimitive.ListProps> = $props();
</script>

<CommandPrimitive.List
	bind:ref
	data-slot="command-list"
	class={cn('flex max-h-72 min-h-0 flex-1 flex-col outline-none', className)}
	{...restProps}
>
	<ScrollAreaPrimitive.Root data-slot="scroll-area" class="relative flex min-h-0 flex-1 flex-col">
		<CommandPrimitive.Viewport>
			{#snippet child({ props })}
				<ScrollAreaPrimitive.Viewport
					{...props}
					data-slot="scroll-area-viewport"
					class="min-h-0 flex-1 scroll-py-1 overscroll-contain p-1"
				>
					{@render children?.()}
				</ScrollAreaPrimitive.Viewport>
			{/snippet}
		</CommandPrimitive.Viewport>
		<Scrollbar orientation="vertical" />
	</ScrollAreaPrimitive.Root>
</CommandPrimitive.List>
