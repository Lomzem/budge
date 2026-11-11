<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { cn, type WithoutChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithoutChild<SelectPrimitive.TriggerProps> = $props();
</script>

<SelectPrimitive.Trigger
	bind:ref
	data-slot="select-trigger"
	class={cn(
		'flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card pr-2 pl-3 text-left text-base transition-colors select-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:outline-destructive data-placeholder:text-muted-foreground pointer-coarse:h-11 [&_svg]:pointer-events-none [&_svg]:shrink-0',
		className
	)}
	{...restProps}
>
	{@render children?.()}
	<ChevronDownIcon class="size-4 text-muted-foreground" />
</SelectPrimitive.Trigger>
