import type { FunctionReturnType } from 'convex/server';

import type { api } from '$convex/_generated/api';

export type ManagedGroup = FunctionReturnType<typeof api.categories.list>['groups'][number];
