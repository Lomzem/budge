<script lang="ts">
	import { Command as CommandPrimitive } from 'bits-ui';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		checked = false,
		children,
		...restProps
	}: CommandPrimitive.ItemProps & { checked?: boolean } = $props();
</script>

<CommandPrimitive.Item
	bind:ref
	data-slot="command-item"
	data-checked={checked ? '' : undefined}
	class={cn(
		'relative flex min-h-9 w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-selected:bg-accent data-selected:text-accent-foreground pointer-coarse:min-h-11 data-disabled:pointer-events-none data-disabled:opacity-50',
		className
	)}
	{...restProps}
>
	<span class="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
		{#if checked}
			<CheckIcon aria-hidden="true" class="size-4" />
		{/if}
	</span>
	<span class="min-w-0 flex-1">{@render children?.()}</span>
</CommandPrimitive.Item>
