<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import ContextMenuPortal from './context-menu-portal.svelte';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		collisionPadding = 8,
		portalProps,
		class: className,
		children,
		...restProps
	}: ContextMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof ContextMenuPortal>>;
	} = $props();
</script>

<ContextMenuPortal {...portalProps}>
	<ContextMenuPrimitive.Content
		bind:ref
		data-slot="context-menu-content"
		{collisionPadding}
		class={cn(
			'z-50 flex max-h-(--bits-context-menu-content-available-height) w-max max-w-(--bits-context-menu-content-available-width) min-w-44 origin-(--bits-context-menu-content-transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-border duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
			className
		)}
		{...restProps}
	>
		<ScrollArea>
			<div class="p-1">{@render children?.()}</div>
		</ScrollArea>
	</ContextMenuPrimitive.Content>
</ContextMenuPortal>
