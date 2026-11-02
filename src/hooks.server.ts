import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';

import { themeScript } from '$lib/themeScript';

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
