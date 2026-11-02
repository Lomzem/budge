import { setupAuth, setupConvex, type FetchAccessToken } from 'convex-svelte';
import { Option } from 'effect';
import { useClerkContext } from 'svelte-clerk';

import { PUBLIC_CONVEX_URL } from '$env/static/public';

import { attempt } from './attempt';

export function setupConvexWithClerk() {
	const convexUrlFromBuild = Option.getOrThrowWith(
		Option.liftPredicate(PUBLIC_CONVEX_URL, (url) => url !== ''),
		() => new Error('PUBLIC_CONVEX_URL is not set.')
	);
	setupConvex(convexUrlFromBuild);

	const clerk = useClerkContext();
	const sessionId = $derived(clerk.session?.id);

	const fetchAccessTokenStableWithinSession: FetchAccessToken = $derived.by(() => {
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
		fetchAccessToken: fetchAccessTokenStableWithinSession
	}));
}
