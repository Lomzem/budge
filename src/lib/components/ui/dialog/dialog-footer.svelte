<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		error,
		showCloseButton = false,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		error?: string;
		showCloseButton?: boolean;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="dialog-footer"
	class={cn(
		'sticky -bottom-5 z-10 -mx-5 -mb-5 flex flex-col gap-2 rounded-b-xl border-t bg-muted px-5 py-4 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:gap-4 sm:px-6',
		className
	)}
	{...restProps}
>
	{#if error !== undefined}
		<p role="alert" class="min-h-5 text-sm text-destructive sm:min-h-10 sm:min-w-0 sm:flex-1">
			{error}
		</p>
	{/if}
	<div
		class="flex flex-wrap gap-2 *:flex-1 sm:ml-auto sm:flex-nowrap sm:justify-end sm:*:flex-none"
	>
		{@render children?.()}
		{#if showCloseButton}
			<DialogPrimitive.Close>
				{#snippet child({ props })}
					<Button variant="outline" {...props}>Close</Button>
				{/snippet}
			</DialogPrimitive.Close>
		{/if}
	</div>
</div>
