import { type VariantProps, tv } from 'tailwind-variants';

export const tableColumnVariants = tv({
	variants: {
		align: { start: '', center: 'text-center', end: 'text-right' },
		width: { auto: '', fit: 'w-0', fill: 'w-full max-w-0' },
		showFrom: {
			always: '',
			lg: 'hidden @lg:table-cell',
			xl: 'hidden @xl:table-cell',
			'2xl': 'hidden @2xl:table-cell',
			'screen-sm': 'hidden sm:table-cell'
		},
		numeric: { true: 'tabular-nums', false: '' }
	},
	defaultVariants: { align: 'start', width: 'auto', showFrom: 'always', numeric: false }
});

export type TableColumnVariants = VariantProps<typeof tableColumnVariants>;
