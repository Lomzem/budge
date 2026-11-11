<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn, type WithoutChild } from '$lib/utils.js';
	import type { WithoutChildrenOrChild } from '$lib/utils.js';
	import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
	import SelectPortal from './select-portal.svelte';
	import Scrollbar from '../scroll-area/scroll-area-scrollbar.svelte';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		collisionPadding = 8,
		portalProps,
		children,
		preventScroll = true,
		...restProps
	}: WithoutChild<SelectPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SelectPortal>>;
	} = $props();
</script>

<SelectPortal {...portalProps}>
	<SelectPrimitive.Content
		bind:ref
		{sideOffset}
		{collisionPadding}
		{preventScroll}
		data-slot="select-content"
		class={cn(
			'relative z-50 flex max-h-(--bits-select-content-available-height) max-w-(--bits-select-content-available-width) min-w-(--bits-select-anchor-width) origin-(--bits-select-content-transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-border duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
			className
		)}
		{...restProps}
	>
		<ScrollAreaPrimitive.Root data-slot="scroll-area" class="relative flex min-h-0 flex-1 flex-col">
			<SelectPrimitive.Viewport>
				{#snippet child({ props })}
					<ScrollAreaPrimitive.Viewport
						{...props}
						data-slot="scroll-area-viewport"
						class="min-h-0 flex-1 overscroll-contain p-1"
					>
						{@render children?.()}
					</ScrollAreaPrimitive.Viewport>
				{/snippet}
			</SelectPrimitive.Viewport>
			<Scrollbar orientation="vertical" />
		</ScrollAreaPrimitive.Root>
	</SelectPrimitive.Content>
</SelectPortal>
