import { buildClerkProps } from 'svelte-clerk/server';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({ ...buildClerkProps(locals.auth()) });
