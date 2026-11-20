import { useQuery, type UseQueryReturn } from 'convex-svelte';
import { createContext } from 'svelte';

import { api } from '$convex/_generated/api';

export class ShellQueries {
	readonly settings: UseQueryReturn<typeof api.settings.get>;
	readonly unapprovedCount: UseQueryReturn<typeof api.transactions.unapprovedCount>;
	readonly bankChangeCount: UseQueryReturn<typeof api.transactions.bankChangeCount>;
	readonly categories: UseQueryReturn<typeof api.categories.list>;
	readonly payees: UseQueryReturn<typeof api.payees.list>;
	readonly settled = $derived.by(() =>
		this.#all().every((query) => query.data !== undefined || query.error !== undefined)
	);
	readonly error = $derived(this.#all().find((query) => query.error !== undefined)?.error);

	constructor(enabled: () => boolean) {
		const args = () => (enabled() ? {} : 'skip');
		this.settings = useQuery(api.settings.get, args);
		this.unapprovedCount = useQuery(api.transactions.unapprovedCount, args);
		this.bankChangeCount = useQuery(api.transactions.bankChangeCount, args);
		this.categories = useQuery(api.categories.list, args);
		this.payees = useQuery(api.payees.list, args);
	}

	#all() {
		return [
			this.settings,
			this.unapprovedCount,
			this.bankChangeCount,
			this.categories,
			this.payees
		];
	}
}

export const [getShellQueries, setShellQueries] = createContext<ShellQueries>();
