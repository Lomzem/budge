import type { AvailableStatus } from '$lib/domain/budget';

/** Color is never the only signal: every colored amount has its status in words beside it. */
export const AVAILABLE_STATUS: Record<
	AvailableStatus,
	{ text: string; class: string } | undefined
> = {
	funded: { text: 'Funded', class: 'text-funded' },
	underfunded: { text: 'Underfunded', class: 'text-warning' },
	overspent: { text: 'Overspent', class: 'text-destructive' },
	empty: undefined
};
