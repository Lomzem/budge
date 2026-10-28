import { buildClerkProps } from 'svelte-clerk/server';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, setHeaders }) => {
	// Pages carry the owner's session state; nothing may cache them.
	setHeaders({ 'cache-control': 'private, no-store' });
	return { ...buildClerkProps(locals.auth()) };
};
