import { type VariantProps, tv } from 'tailwind-variants';

// `align` replaces the obsolete HTML attribute of the same name.
// Shared by TableHead and TableCell so a column's header and cells always agree.
// `showFrom` hides a column until the table's @container is at least that wide.
export const tableColumnVariants = tv({
	variants: {
		align: { start: '', center: 'text-center', end: 'text-right' },
		width: { auto: '', fit: 'w-0', fill: 'w-full max-w-0' },
		showFrom: { always: '', xl: 'hidden @xl:table-cell', '2xl': 'hidden @2xl:table-cell' },
		numeric: { true: 'tabular-nums', false: '' }
	},
	defaultVariants: { align: 'start', width: 'auto', showFrom: 'always', numeric: false }
});

export type TableColumnVariants = VariantProps<typeof tableColumnVariants>;
