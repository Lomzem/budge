import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';

import { themeScript } from '$lib/themeScript';

const BODY_FONT_FILE = 'atkinson-hyperlegible-next-latin-wght-normal';

const noStore: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('cache-control', 'private, no-store');
	return response;
};

export const handle = sequence(noStore, withClerkHandler(), ({ event, resolve }) =>
	resolve(event, {
		preload: ({ type, path }) =>
			type === 'js' || type === 'css' || (type === 'font' && path.includes(BODY_FONT_FILE)),
		transformPageChunk: ({ html }) => html.replace('%budge.themeScript%', themeScript)
	})
);
