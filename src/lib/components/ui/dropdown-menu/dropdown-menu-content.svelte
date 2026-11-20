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
			if (ref?.contains(document.activeElement) && document.activeElement !== ref) return;
			ref?.querySelector<HTMLElement>('[role^="menuitem"]:not([data-disabled])')?.focus();
		},
		onInteractOutside,
		onCloseAutoFocus,
		...restProps
	}: DropdownMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
	} = $props();

	let triggerOfAClickOutside: HTMLElement | null = null;

	function rememberTheTriggerOfAClickOutside(event: PointerEvent) {
		onInteractOutside?.(event);
		triggerOfAClickOutside = ref?.id
			? document.querySelector<HTMLElement>(`[aria-controls="${ref.id}"]`)
			: null;
	}

	function focusTheTriggerAfterAClickOutsideOnlyClosedTheMenu(event: Event) {
		const trigger = triggerOfAClickOutside;
		triggerOfAClickOutside = null;
		onCloseAutoFocus?.(event);
		if (event.defaultPrevented || !trigger?.isConnected) return;
		event.preventDefault();
		trigger.focus();
	}
</script>

<DropdownMenuPortal {...portalProps}>
	<DropdownMenuPrimitive.Content
		bind:ref
		data-slot="dropdown-menu-content"
		{sideOffset}
		{collisionPadding}
		{align}
		{onOpenAutoFocus}
		onInteractOutside={rememberTheTriggerOfAClickOutside}
		onCloseAutoFocus={focusTheTriggerAfterAClickOutsideOnlyClosedTheMenu}
		class={cn(
			'z-50 flex max-h-(--bits-dropdown-menu-content-available-height) w-max max-w-(--bits-dropdown-menu-content-available-width) min-w-44 origin-(--bits-dropdown-menu-content-transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-border duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
			className
		)}
		{...restProps}
	>
		<ScrollArea>
			<div class="p-1">{@render children?.()}</div>
		</ScrollArea>
	</DropdownMenuPrimitive.Content>
</DropdownMenuPortal>
