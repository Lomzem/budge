import type { FunctionReference } from 'convex/server';
import { convexToJson, jsonToConvex, type JSONValue, type Value } from 'convex/values';
import {
	usePaginatedQuery as subscribeEveryTimeArgsAreRead,
	type UsePaginatedQueryOptions,
	type UsePaginatedQueryReturn
} from 'convex-svelte';

type ArgsOrSkip<Query extends FunctionReference<'query'>> = Exclude<
	Parameters<typeof subscribeEveryTimeArgsAreRead<Query>>[1],
	undefined | ((...args: never[]) => unknown)
>;

export function usePaginatedQuery<Query extends FunctionReference<'query'>>(
	query: Query,
	args: () => ArgsOrSkip<Query>,
	options: UsePaginatedQueryOptions<Query>
): UsePaginatedQueryReturn<Query> {
	const resubscribesOnlyWhenThisChanges = $derived(JSON.stringify(convexToJson(args() as Value)));
	return subscribeEveryTimeArgsAreRead(
		query,
		() =>
			jsonToConvex(JSON.parse(resubscribesOnlyWhenThisChanges) as JSONValue) as ArgsOrSkip<Query>,
		options
	);
}
