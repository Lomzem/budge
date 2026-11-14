<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	export const popoverTriggerVariants = tv({
		base: 'min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0',
		variants: {
			variant: {
				none: '',
				field:
					'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card pr-2 pl-3 text-base transition-colors select-none focus-visible:border-ring disabled:bg-muted aria-invalid:border-destructive aria-invalid:outline-destructive data-placeholder:text-muted-foreground pointer-coarse:h-11',
				inline:
					'relative inline-flex max-w-full items-center gap-1 rounded-sm hover:underline pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-2.5'
			}
		},
		defaultVariants: { variant: 'none' }
	});

	export type PopoverTriggerVariant = VariantProps<typeof popoverTriggerVariants>['variant'];
</script>

<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		variant = 'none',
		...restProps
	}: PopoverPrimitive.TriggerProps & { variant?: PopoverTriggerVariant } = $props();
</script>

<PopoverPrimitive.Trigger
	bind:ref
	data-slot="popover-trigger"
	class={cn(popoverTriggerVariants({ variant }), className)}
	{...restProps}
/>
