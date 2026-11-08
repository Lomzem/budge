import CoinsIcon from '@lucide/svelte/icons/coins';
import LandmarkIcon from '@lucide/svelte/icons/landmark';
import SettingsIcon from '@lucide/svelte/icons/settings';
import TagsIcon from '@lucide/svelte/icons/tags';
import WalletIcon from '@lucide/svelte/icons/wallet';

export const SECTIONS = [
	{ href: '/', label: 'Budget', icon: CoinsIcon },
	{ href: '/accounts', label: 'Accounts', icon: WalletIcon },
	{ href: '/bank', label: 'Bank', icon: LandmarkIcon },
	{ href: '/categories', label: 'Categories', icon: TagsIcon },
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
