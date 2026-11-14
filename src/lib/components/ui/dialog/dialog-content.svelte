<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import * as Dialog from './index.js';
	import DialogPortal from './dialog-portal.svelte';
	import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
	import Scrollbar from '../scroll-area/scroll-area-scrollbar.svelte';
	import { untrack, type Snippet } from 'svelte';
	import type { ComponentProps } from 'svelte';
	import { dialogOpener, restoreFocus, type FocusReturn } from '$lib/focusReturn';

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		children,
		showCloseButton = true,
		size = 'default',
		returnFocus,
		onOpenAutoFocus,
		onfocusin,
		...restProps
	}: Omit<WithoutChildrenOrChild<DialogPrimitive.ContentProps>, 'onCloseAutoFocus'> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>;
		children: Snippet;
		showCloseButton?: boolean;

		size?: 'default' | 'wide';
		returnFocus: FocusReturn;
	} = $props();

	let opened: HTMLElement | null = null;
	let focusEntered = false;

	let body: HTMLElement | null = $state(null);
	let scrolled = $state(false);
	let heading = $state('');

	function measure(element: HTMLElement | null) {
		scrolled = (element?.scrollTop ?? 0) > 8;
		if (scrolled)
			heading = element?.querySelector('[data-slot="dialog-title"]')?.textContent.trim() ?? '';
	}

	function onscroll() {
		measure(body);
	}

	$effect(() => {
		const element = body;
		untrack(() => {
			measure(element);
		});
	});
</script>

<DialogPortal {...portalProps}>
	<Dialog.Overlay />
	<DialogPrimitive.Content
		bind:ref
		data-slot="dialog-content"
		class={cn(
			'fixed top-4 left-1/2 z-50 flex max-h-dialog-height w-full max-w-dialog-width -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground shadow-xl ring-1 ring-border duration-150 outline-none sm:top-16 sm:max-h-dialog-height-sm sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
			size === 'wide' && 'sm:max-w-3xl',
			className
		)}
		{...restProps}
		onOpenAutoFocus={(event: Event) => {
			opened = dialogOpener();
			focusEntered = false;
			onOpenAutoFocus?.(event);
		}}
		onfocusin={(event) => {
			focusEntered = true;
			onfocusin?.(event);
		}}
		onCloseAutoFocus={(event: Event) => {
			event.preventDefault();
			restoreFocus(returnFocus, opened, ref, focusEntered);
		}}
	>
		<ScrollAreaPrimitive.Root data-slot="scroll-area" class="relative flex min-h-0 flex-1 flex-col">
			<ScrollAreaPrimitive.Viewport
				bind:ref={body}
				{onscroll}
				data-slot="dialog-body"
				class={[
					'min-h-0 flex-1 scroll-pb-40 overscroll-contain sm:scroll-pb-24',
					showCloseButton && 'scroll-pt-20 pointer-coarse:scroll-pt-24'
				]}
			>
				<div class="grid gap-5 p-5 sm:p-6">{@render children()}</div>
			</ScrollAreaPrimitive.Viewport>
			<Scrollbar orientation="vertical" />
		</ScrollAreaPrimitive.Root>
		{#if showCloseButton}
			<div
				data-slot="dialog-bar"
				class={[
					'pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3 rounded-t-xl border-b py-3 pr-3 pl-5 sm:pl-6',
					scrolled ? 'border-border bg-popover' : 'border-transparent'
				]}
			>
				<p
					aria-hidden="true"
					class={['line-clamp-2 min-w-0 flex-1 text-base font-bold', !scrolled && 'invisible']}
				>
					{heading}
				</p>
				<DialogPrimitive.Close data-slot="dialog-close">
					{#snippet child({ props })}
						<div class="pointer-events-auto rounded-md bg-popover">
							<Button variant="ghost" size="icon" {...props}>
								<XIcon />
								<span class="sr-only">Close</span>
							</Button>
						</div>
					{/snippet}
				</DialogPrimitive.Close>
			</div>
		{/if}
	</DialogPrimitive.Content>
</DialogPortal>
