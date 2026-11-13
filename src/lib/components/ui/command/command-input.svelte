<script lang="ts">
	import { Command as CommandPrimitive } from 'bits-ui';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		value = $bindable(''),
		...restProps
	}: CommandPrimitive.InputProps = $props();
</script>

<div data-slot="command-input-wrapper" class="relative shrink-0 border-b border-border p-1">
	<SearchIcon
		aria-hidden="true"
		class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
	/>
	<CommandPrimitive.Input
		bind:ref
		bind:value
		data-slot="command-input"
		class={cn(
			'h-9 w-full min-w-0 rounded-md bg-transparent pr-2 pl-8 text-base outline-hidden placeholder:text-muted-foreground focus-visible:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:h-11',
			className
		)}
		{...restProps}
	/>
</div>
