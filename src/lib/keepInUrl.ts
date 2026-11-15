import { goto } from '$app/navigation';
import type { ResolvedPathname } from '$app/types';

export function keepInUrl(url: URL) {
	if (url.href === location.href) return;
	const samePage = `${url.pathname}${url.search}${url.hash}` as ResolvedPathname;
	void goto(samePage, { replaceState: true, keepFocus: true, noScroll: true });
}
