<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import * as Dialog from './index.js';
	import DialogPortal from './dialog-portal.svelte';
	import type { Snippet } from 'svelte';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		children,
		showCloseButton = true,
		size = 'default',
		...restProps
	}: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>;
		children: Snippet;
		showCloseButton?: boolean;

		size?: 'default' | 'wide';
	} = $props();
</script>

<DialogPortal {...portalProps}>
	<Dialog.Overlay />
	<DialogPrimitive.Content
		bind:ref
		data-slot="dialog-content"
		class={cn(
			'fixed top-4 left-1/2 z-50 grid max-h-dialog-height w-full max-w-dialog-width -translate-x-1/2 gap-5 overflow-y-auto overscroll-contain rounded-xl bg-popover p-5 text-sm text-popover-foreground shadow-xl ring-1 ring-border duration-150 outline-none sm:top-16 sm:max-h-dialog-height-sm sm:max-w-md sm:p-6 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
			size === 'wide' && 'sm:max-w-3xl',
			className
		)}
		{...restProps}
	>
		{@render children()}
		{#if showCloseButton}
			<DialogPrimitive.Close data-slot="dialog-close">
				{#snippet child({ props })}
					<div class="absolute top-3 right-3">
						<Button variant="ghost" size="icon" {...props}>
							<XIcon />
							<span class="sr-only">Close</span>
						</Button>
					</div>
				{/snippet}
			</DialogPrimitive.Close>
		{/if}
	</DialogPrimitive.Content>
</DialogPortal>
