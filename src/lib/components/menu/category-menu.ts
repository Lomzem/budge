import type { Id } from '$convex/_generated/dataModel';
import type { CategoryActions } from '$lib/categoryActions.svelte';

import type { MenuEntry } from './types';

export function categoryMenu(
	actions: CategoryActions,
	categoryId: Id<'categories'>,
	{ rename, remove }: { rename: () => void; remove: () => void }
): MenuEntry[] {
	const group = actions.groups.find((g) => g.categories.some((c) => c._id === categoryId));
	if (group === undefined) return [];
	const visibleNeighbours = group.categories.filter((c) => !c.hidden || c._id === categoryId);
	const at = visibleNeighbours.findIndex((c) => c._id === categoryId);
	const above = visibleNeighbours[at - 1];
	const below = visibleNeighbours[at + 1];
	return [
		{ kind: 'item', label: 'Rename', run: rename },
		{
			kind: 'item',
			label: 'Move up',
			disabled: above === undefined,
			run: () => {
				if (above) actions.placeCategory(group._id, categoryId, above._id);
			}
		},
		{
			kind: 'item',
			label: 'Move down',
			disabled: below === undefined,
			run: () => {
				if (below) actions.placeCategory(group._id, categoryId, below._id);
			}
		},
		{
			kind: 'sub',
			label: 'Move to group',
			items: actions.groups
				.filter((other) => other._id !== group._id)
				.map((other) => ({
					key: other._id,
					label: other.name,
					run: () => {
						actions.moveToGroup(categoryId, other._id);
					}
				}))
		},
		{
			kind: 'item',
			label: 'Hide',
			run: () => {
				actions.setHidden(categoryId, true);
			}
		},
		{ kind: 'separator' },
		{ kind: 'item', label: 'Delete…', destructive: true, run: remove }
	];
}
