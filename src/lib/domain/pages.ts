const maximumBytesRead = 4 * 1024 * 1024;

export interface PageOptions {
	numItems: number;
	cursor: string | null;
	endCursor?: string | null;
	maximumBytesRead?: number;
}

export interface Page<T> {
	page: T[];
	isDone: boolean;
	continueCursor: string;
	splitCursor?: string | null;
	pageStatus?: 'SplitRecommended' | 'SplitRequired' | null;
}

type Range = Pick<PageOptions, 'cursor' | 'endCursor'>;

export async function readAllPages<T>(
	readPage: (options: PageOptions) => Promise<Page<T>>,
	{ numItems }: { numItems: number }
): Promise<T[]> {
	const rows: T[] = [];
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
