<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';
	import type { ResolvedPathname } from '$app/types';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	export const buttonVariants = tv({
		base: "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:outline-destructive rounded-md border border-transparent bg-clip-padding text-sm font-medium active:not-aria-[haspopup]:translate-y-px [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/90',
				outline:
					'border-input bg-card hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground',
				secondary:
					'bg-secondary text-secondary-foreground hover:bg-secondary-hover aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
				ghost:
					'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground',
				destructive:
					'bg-destructive-tint text-destructive hover:bg-destructive hover:text-background focus-visible:outline-destructive',
				link: 'text-primary underline underline-offset-4 hover:no-underline'
			},
			size: {
				default:
					'h-9 gap-2 px-3.5 pointer-coarse:h-11 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
				xs: "h-6 gap-1 rounded-button-xs px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
				sm: "h-8 gap-1.5 rounded-button-sm px-3 pointer-coarse:h-11 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4",
				lg: 'h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4',

				wrap: 'min-h-9 gap-2 px-3.5 py-1.5 whitespace-normal pointer-coarse:min-h-11',
				icon: 'size-9 pointer-coarse:size-11',
				'icon-xs':
					"size-6 rounded-button-xs in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3.5",
				'icon-sm':
					'size-8 rounded-button-sm pointer-coarse:size-11 in-data-[slot=button-group]:rounded-md',
				'icon-lg': 'size-11'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<Omit<HTMLAnchorAttributes, 'href'>> & {
			href?: ResolvedPathname | null | undefined;
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
