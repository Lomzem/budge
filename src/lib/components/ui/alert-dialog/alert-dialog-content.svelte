<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import { cn, type WithoutChild, type WithoutChildrenOrChild } from '$lib/utils.js';
	import AlertDialogOverlay from './alert-dialog-overlay.svelte';
	import AlertDialogPortal from './alert-dialog-portal.svelte';
	import type { ComponentProps } from 'svelte';
	import { dialogOpener, restoreFocus, type FocusReturn } from '$lib/focusReturn';

	let {
		ref = $bindable(null),
		class: className,
		size = 'default',
		portalProps,
		returnFocus,
		onOpenAutoFocus,
		...restProps
	}: Omit<WithoutChild<AlertDialogPrimitive.ContentProps>, 'onCloseAutoFocus'> & {
		size?: 'default' | 'sm';
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof AlertDialogPortal>>;
		returnFocus: FocusReturn;
	} = $props();

	let opened: HTMLElement | null = null;
</script>

<AlertDialogPortal {...portalProps}>
	<AlertDialogOverlay />
	<AlertDialogPrimitive.Content
		bind:ref
		data-slot="alert-dialog-content"
		data-size={size}
		class={cn(
			'group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-5 rounded-xl bg-popover p-5 text-popover-foreground shadow-xl ring-1 ring-border duration-150 outline-none data-[size=default]:max-w-dialog-width data-[size=sm]:max-w-xs sm:p-6 data-[size=default]:sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
			className
		)}
		{...restProps}
		onOpenAutoFocus={(event: Event) => {
			opened = dialogOpener();
			onOpenAutoFocus?.(event);
		}}
		onCloseAutoFocus={(event: Event) => {
			event.preventDefault();
			restoreFocus(returnFocus, opened, ref);
		}}
	/>
</AlertDialogPortal>
