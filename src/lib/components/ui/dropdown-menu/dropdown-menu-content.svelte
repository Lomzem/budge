<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import DropdownMenuPortal from './dropdown-menu-portal.svelte';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		sideOffset = 4,
		collisionPadding = 8,
		align = 'start',
		portalProps,
		class: className,
		children,
		onOpenAutoFocus = (event: Event) => {
			event.preventDefault();
			ref?.querySelector<HTMLElement>('[role^="menuitem"]:not([data-disabled])')?.focus();
		},
		...restProps
	}: DropdownMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
	} = $props();
</script>

<DropdownMenuPortal {...portalProps}>
	<DropdownMenuPrimitive.Content
		bind:ref
		data-slot="dropdown-menu-content"
		{sideOffset}
		{collisionPadding}
		{align}
		{onOpenAutoFocus}
		class={cn(
			'z-50 flex max-h-(--bits-dropdown-menu-content-available-height) w-max max-w-(--bits-dropdown-menu-content-available-width) min-w-44 origin-(--bits-dropdown-menu-content-transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-border duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
			className
		)}
		{...restProps}
	>
		<ScrollArea>
			<div class="p-1">{@render children?.()}</div>
		</ScrollArea>
	</DropdownMenuPrimitive.Content>
</DropdownMenuPortal>
