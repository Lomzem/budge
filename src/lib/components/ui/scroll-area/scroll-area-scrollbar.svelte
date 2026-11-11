<script lang="ts">
	import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';

	let { orientation }: { orientation: 'vertical' | 'horizontal' } = $props();
</script>

<ScrollAreaPrimitive.Scrollbar
	data-slot="scroll-area-scrollbar"
	{orientation}
	class={[
		'flex touch-none p-px transition-colors select-none',
		orientation === 'vertical' ? 'h-full w-2.5' : 'h-2.5 flex-col'
	]}
>
	<ScrollAreaPrimitive.Thumb
		data-slot="scroll-area-thumb"
		class="relative flex-1 rounded-full bg-muted-foreground/40 hover:bg-muted-foreground/60"
	/>
</ScrollAreaPrimitive.Scrollbar>
