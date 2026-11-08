import { type VariantProps, tv } from 'tailwind-variants';

export const tableColumnVariants = tv({
	variants: {
		align: { start: '', center: 'text-center', end: 'text-right' },
		width: {
			auto: '',
			fit: 'w-0',
			fill: 'w-full max-w-0',
			action: 'w-28',
			check: 'w-16 sm:w-20',
			amount: 'w-28 sm:w-32',
			date: 'w-32',
			name: 'w-44',
			note: 'w-48'
		},
		showFrom: {
			always: '',
			lg: 'hidden @lg:table-cell',
			'2xl': 'hidden @2xl:table-cell',
			'4xl': 'hidden @4xl:table-cell',
			'5xl': 'hidden @5xl:table-cell',
			'6xl': 'hidden @6xl:table-cell',
			'8xl': 'hidden @8xl:table-cell',
			'screen-sm': 'hidden sm:table-cell'
		},
		numeric: { true: 'tabular-nums', false: '' }
	},
	defaultVariants: {
		align: 'start',
		width: 'auto',
		showFrom: 'always',
		numeric: false
	}
});

export type TableColumnVariants = VariantProps<typeof tableColumnVariants>;
