<script lang="ts">
	import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import Scrollbar from './scroll-area-scrollbar.svelte';

	let {
		viewportRef = $bindable(null),
		orientation = 'vertical',
		children,
		onscroll
	}: {
		viewportRef?: HTMLElement | null;
		orientation?: 'vertical' | 'horizontal';
		children: Snippet;
		onscroll?: () => void;
	} = $props();
</script>

<ScrollAreaPrimitive.Root
	data-slot="scroll-area"
	class="relative flex min-h-0 min-w-0 flex-1 flex-col"
>
	<ScrollAreaPrimitive.Viewport
		bind:ref={viewportRef}
		data-slot="scroll-area-viewport"
		class={[
			'min-h-0 flex-1 overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
			orientation === 'horizontal' && 'snap-x snap-proximity scroll-px-1'
		]}
		{onscroll}
	>
		{@render children()}
	</ScrollAreaPrimitive.Viewport>
	<Scrollbar {orientation} />
	<ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
