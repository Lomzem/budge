import type { FunctionReturnType } from 'convex/server';

import type { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';

export type ManagedGroup = FunctionReturnType<typeof api.categories.list>['groups'][number];

export type RenameTarget =
	| { kind: 'category'; id: Id<'categories'>; name: string }
	| { kind: 'group'; id: Id<'categoryGroups'>; name: string };
