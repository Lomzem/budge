import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';

import { bodyFont, shellFontFaces } from '$lib/shellFontFaces';
import { themeScript } from '$lib/themeScript';

const noStore: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('cache-control', 'private, no-store');
	return response;
};

export const handle = sequence(noStore, withClerkHandler(), ({ event, resolve }) =>
	resolve(event, {
		preload: ({ type }) => type === 'js' || type === 'css',
		transformPageChunk: ({ html }) =>
			html
				.replace('%budge.bodyFont%', bodyFont)
				.replace('%budge.fontFaces%', shellFontFaces)
				.replace('%budge.themeScript%', themeScript)
	})
);
