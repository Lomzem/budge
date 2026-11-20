<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import DropdownMenuPortal from './dropdown-menu-portal.svelte';
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
	}: DropdownMenuPrimitive.SubContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
	} = $props();

	const besideFits = new MediaQuery('(min-width: 640px)', true);
	const placedSide = $derived(side ?? (besideFits.current ? 'right' : 'bottom'));
</script>

<DropdownMenuPortal {...portalProps}>
	<DropdownMenuPrimitive.SubContent
		bind:ref
		data-slot="dropdown-menu-sub-content"
		{align}
		{alignOffset}
		{collisionPadding}
		side={placedSide}
		class={cn(
			'z-60 min-w-24 origin-(--bits-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
			className
		)}
		{...restProps}
	/>
</DropdownMenuPortal>
