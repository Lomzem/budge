import { setupAuth, setupConvex, type FetchAccessToken } from 'convex-svelte';
import { useClerkContext } from 'svelte-clerk';

import { env } from '$env/dynamic/public';

/**
 * Connects this page to Convex and authenticates it with the Clerk session token, which Clerk's
 * Convex integration issues with `aud: "convex"`. Call once, during component setup, inside
 * `ClerkProvider`.
 */
export function setupConvexWithClerk() {
	const url = env.PUBLIC_CONVEX_URL;
	if (!url) throw new Error('PUBLIC_CONVEX_URL is not set.');
	setupConvex(url);

	const clerk = useClerkContext();
	const sessionId = $derived(clerk.session?.id);
	// A new function only when the session changes, so Clerk's frequent session updates
	// don't make Convex re-authenticate.
	const fetchAccessToken: FetchAccessToken = $derived.by(() => {
		const id = sessionId;
		return async ({ forceRefreshToken }) => {
			const session = clerk.session;
			if (!session || session.id !== id) return null;
			try {
				return await session.getToken({ skipCache: forceRefreshToken });
			} catch {
				return null;
			}
		};
	});

	setupAuth(() => ({
		isLoading: !clerk.isLoaded,
		isAuthenticated: sessionId !== undefined,
		fetchAccessToken
	}));
}
