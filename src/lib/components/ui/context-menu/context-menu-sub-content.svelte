<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import ContextMenuPortal from './context-menu-portal.svelte';
	import type { ComponentProps } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	let {
		ref = $bindable(null),
		class: className,
		align = 'start',
		alignOffset = -3,
		collisionPadding = 8,
		side,
		portalProps,
		...restProps
	}: ContextMenuPrimitive.SubContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof ContextMenuPortal>>;
	} = $props();

	const besideFits = new MediaQuery('(min-width: 640px)', true);
	const placedSide = $derived(side ?? (besideFits.current ? 'right' : 'bottom'));
</script>

<ContextMenuPortal {...portalProps}>
	<ContextMenuPrimitive.SubContent
		bind:ref
		data-slot="context-menu-sub-content"
		{align}
		{alignOffset}
		{collisionPadding}
		side={placedSide}
		class={cn(
			'z-50 min-w-32 origin-(--bits-context-menu-content-transform-origin) overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
			className
		)}
		{...restProps}
	/>
</ContextMenuPortal>
