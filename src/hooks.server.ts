import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';

import { themeScript } from '$lib/themeScript';

export const handle = sequence(withClerkHandler(), ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%budge.themeScript%', themeScript)
	})
);
