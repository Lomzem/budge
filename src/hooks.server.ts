import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';

import { themeScript } from '$lib/themeScript';

// Responses carry the owner's session state; nothing may cache them. Set on the finished
// response rather than with `setHeaders` in a load, which SvelteKit reruns when it renders an
// error page and then rejects as a duplicate header.
const noStore: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('cache-control', 'private, no-store');
	return response;
};

export const handle = sequence(noStore, withClerkHandler(), ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%budge.themeScript%', themeScript)
	})
);
