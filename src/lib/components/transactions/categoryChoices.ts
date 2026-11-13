import type { FunctionReturnType } from 'convex/server';

import type { api } from '$convex/_generated/api';
import type { Choices } from '$lib/components/choices';
import { optionOf, unlisted, type AccountChoice } from '$lib/transactionEditor';

type CategoryList = FunctionReturnType<typeof api.categories.list>;

export const TRANSFER_GROUP = 'Transfer to or from';

export function categoryChoices(
	list: CategoryList | undefined,
	saved?: { readonly id: string; readonly name: string | undefined }
): Choices {
	const keepSaved = saved !== undefined && (list === undefined || unlisted(list, saved.id));
	return [
		...(keepSaved ? [{ value: saved.id, label: saved.name ?? '' }] : []),
		...(list?.readyToAssignId ? [{ value: list.readyToAssignId, label: 'Ready to Assign' }] : []),
		...(list?.groups ?? []).map((group) => ({
			group: group.name,
			choices: group.categories.map((category) => ({ value: category._id, label: category.name }))
		}))
	];
}

export function transferChoices(accounts: readonly AccountChoice[]): Choices {
	if (accounts.length === 0) return [];
	return [
		{
			group: TRANSFER_GROUP,
			choices: accounts.map((account) => ({
				value: optionOf({ kind: 'transfer', accountId: account._id }),
				label: `Transfer: ${account.name}`
			}))
		}
	];
}
