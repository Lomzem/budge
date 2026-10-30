// Bytes one page may read: well under Convex's per-query read limit, so a page of large documents
// splits instead of failing.
const maximumBytesRead = 4 * 1024 * 1024;

/** The options a paginated query takes, as Convex's `PaginationOptions`. */
export interface PageOptions {
	numItems: number;
	cursor: string | null;
	endCursor?: string | null;
	maximumBytesRead?: number;
}

/** One page of a paginated query, as Convex's `PaginationResult`. */
export interface Page<T> {
	page: T[];
	isDone: boolean;
	continueCursor: string;
	splitCursor?: string | null;
	pageStatus?: 'SplitRecommended' | 'SplitRequired' | null;
}

type Range = Pick<PageOptions, 'cursor' | 'endCursor'>;

/**
 * Every row of a paginated query, in order. A page Convex marks 'SplitRequired' may be missing
 * rows, so its range is read again as two halves instead.
 */
export async function readAllPages<T>(
	readPage: (options: PageOptions) => Promise<Page<T>>,
	{ numItems }: { numItems: number }
): Promise<T[]> {
	const rows: T[] = [];
	// Ranges still to read, the next one last. A range with no end runs on to the end of the query.
	const ranges: Range[] = [{ cursor: null }];
	for (let range = ranges.pop(); range !== undefined; range = ranges.pop()) {
		const result = await readPage({ ...range, numItems, maximumBytesRead });
		if (range.endCursor === undefined && !result.isDone) {
			ranges.push({ cursor: result.continueCursor });
		}
		const { splitCursor } = result;
		if (result.pageStatus === 'SplitRequired' && splitCursor) {
			ranges.push(
				{ cursor: splitCursor, endCursor: result.continueCursor },
				{ cursor: range.cursor, endCursor: splitCursor }
			);
			continue;
		}
		rows.push(...result.page);
	}
	return rows;
}
