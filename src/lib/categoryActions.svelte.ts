import { useMutation } from 'convex-svelte';
import { SvelteMap } from 'svelte/reactivity';

import { api } from '$convex/_generated/api';
import { getShellQueries } from '$lib/shellQueries.svelte';
import type { Id } from '$convex/_generated/dataModel';
import { attempt } from '$lib/attempt';
import type { ManagedGroup } from '$lib/components/categories/types';
import { moveInList } from '$lib/reorder';

const refused = "Budge couldn't save that. Try again.";

function placeIn<T>(
	items: readonly T[],
	idOf: (item: T) => string,
	id: string,
	target: string
): T[] {
	const from = items.findIndex((item) => idOf(item) === id);
	const to = items.findIndex((item) => idOf(item) === target);
	return from === -1 || to === -1 ? [...items] : moveInList(items, from, to);
}

export class CategoryActions {
	readonly #list = getShellQueries().categories;
	readonly #rename = useMutation(api.categories.rename);
	readonly #renameGroup = useMutation(api.categories.renameGroup);
	readonly #move = useMutation(api.categories.move);
	readonly #moveGroup = useMutation(api.categories.moveGroup);
	readonly #setHidden = useMutation(api.categories.setHidden);
	readonly #setGroupHidden = useMutation(api.categories.setGroupHidden);
	readonly #latest = new SvelteMap<string, number>();

	readonly groups: ManagedGroup[] = $derived(this.#list.data?.groups ?? []);
	failure: { id: string; message: string } | null = $state(null);

	rename(categoryId: Id<'categories'>, name: string) {
		return this.#rename({ categoryId, name });
	}

	renameGroup(groupId: Id<'categoryGroups'>, name: string) {
		return this.#renameGroup({ groupId, name });
	}

	placeCategory(
		groupId: Id<'categoryGroups'>,
		categoryId: Id<'categories'>,
		target: Id<'categories'>
	) {
		const index =
			this.groups.find((g) => g._id === groupId)?.categories.findIndex((c) => c._id === target) ??
			-1;
		if (index === -1 || target === categoryId) return;
		void this.#save(categoryId, () =>
			this.#move(
				{ categoryId, groupId, index },
				{
					optimisticUpdate: (store) => {
						const listed = store.getQuery(api.categories.list, {});
						if (listed !== undefined)
							store.setQuery(
								api.categories.list,
								{},
								{
									...listed,
									groups: listed.groups.map((g) =>
										g._id === groupId
											? {
													...g,
													categories: placeIn(g.categories, (c) => c._id, categoryId, target)
												}
											: g
									)
								}
							);
						for (const { args, value } of store.getAllQueries(api.budget.month)) {
							if (value === undefined) continue;
							store.setQuery(api.budget.month, args, {
								...value,
								groups: value.groups.map((g) =>
									g.id === groupId
										? { ...g, categories: placeIn(g.categories, (c) => c.id, categoryId, target) }
										: g
								)
							});
						}
					}
				}
			)
		);
	}

	moveToGroup(categoryId: Id<'categories'>, groupId: Id<'categoryGroups'>) {
		const index = this.groups.find((g) => g._id === groupId)?.categories.length;
		if (index === undefined) return;
		void this.#save(categoryId, () => this.#move({ categoryId, groupId, index }));
	}

	placeGroup(groupId: Id<'categoryGroups'>, target: Id<'categoryGroups'>) {
		const index = this.groups.findIndex((g) => g._id === target);
		if (index === -1 || target === groupId) return;
		void this.#save(groupId, () =>
			this.#moveGroup(
				{ groupId, index },
				{
					optimisticUpdate: (store) => {
						const listed = store.getQuery(api.categories.list, {});
						if (listed !== undefined)
							store.setQuery(
								api.categories.list,
								{},
								{ ...listed, groups: placeIn(listed.groups, (g) => g._id, groupId, target) }
							);
						for (const { args, value } of store.getAllQueries(api.budget.month)) {
							if (value === undefined) continue;
							store.setQuery(api.budget.month, args, {
								...value,
								groups: placeIn(value.groups, (g) => g.id, groupId, target)
							});
						}
					}
				}
			)
		);
	}

	setHidden(categoryId: Id<'categories'>, hidden: boolean) {
		return this.#save(categoryId, () => this.#setHidden({ categoryId, hidden }));
	}

	setGroupHidden(groupId: Id<'categoryGroups'>, hidden: boolean) {
		return this.#save(groupId, () => this.#setGroupHidden({ groupId, hidden }));
	}

	async #save(id: string, save: () => Promise<unknown>) {
		const ticket = (this.#latest.get(id) ?? 0) + 1;
		this.#latest.set(id, ticket);
		if (this.failure?.id === id) this.failure = null;
		const saved = await attempt(save);
		if (saved.ok || this.#latest.get(id) !== ticket) return saved.ok;
		this.failure = { id, message: saved.error?.message ?? refused };
		return false;
	}
}
