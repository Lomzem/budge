import CoinsIcon from '@lucide/svelte/icons/coins';
import LandmarkIcon from '@lucide/svelte/icons/landmark';
import ReceiptIcon from '@lucide/svelte/icons/receipt';
import SettingsIcon from '@lucide/svelte/icons/settings';

export const SECTIONS = [
	{ href: '/', label: 'Budget', icon: CoinsIcon },
	{ href: '/transactions', label: 'Transactions', icon: ReceiptIcon },
	{ href: '/bank', label: 'Bank', icon: LandmarkIcon },
	{ href: '/settings', label: 'Settings', icon: SettingsIcon }
] as const;

export type Section = (typeof SECTIONS)[number];

export function sectionOf(pathname: string): Section | undefined {
	return SECTIONS.find((section) =>
		section.href === '/'
			? pathname === '/'
			: pathname === section.href || pathname.startsWith(`${section.href}/`)
	);
}
