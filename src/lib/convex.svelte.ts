import { setupAuth, setupConvex, type FetchAccessToken } from 'convex-svelte';
import { Option } from 'effect';
import { useClerkContext } from 'svelte-clerk';

import { PUBLIC_CONVEX_URL } from '$env/static/public';

import { attempt } from './attempt';

/**
 * Connects this page to Convex and authenticates it with the Clerk session token, which Clerk's
 * Convex integration issues with `aud: "convex"`. Call once, during component setup, inside
 * `ClerkProvider`.
 */
export function setupConvexWithClerk() {
	// Read at build time: `convex deploy` gives each deployment's URL only to the build it runs.
	// Without it the app can't run, so rendering fails as a defect.
	const convexUrl = Option.getOrThrowWith(
		Option.liftPredicate(PUBLIC_CONVEX_URL, (url) => url !== ''),
		() => new Error('PUBLIC_CONVEX_URL is not set.')
	);
	setupConvex(convexUrl);

	const clerk = useClerkContext();
	const sessionId = $derived(clerk.session?.id);
	// A new function only when the session changes, so Clerk's frequent session updates
	// don't make Convex re-authenticate.
	const fetchAccessToken: FetchAccessToken = $derived.by(() => {
		const id = sessionId;
		return async ({ forceRefreshToken }) => {
			const session = clerk.session;
			if (!session || session.id !== id) return null;
			const token = await attempt(() => session.getToken({ skipCache: forceRefreshToken }));
			return token.ok ? token.value : null;
		};
	});

	setupAuth(() => ({
		isLoading: !clerk.isLoaded,
		isAuthenticated: sessionId !== undefined,
		fetchAccessToken
	}));
}
