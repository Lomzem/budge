import { describe, expect, test } from 'vitest';

import { type PageOptions, type Page, readAllPages } from './pages';

// A paginated source as Convex documents it: a page that reads more than `maximumBytesRead` comes
// back 'SplitRequired', possibly missing rows, with a `splitCursor` inside its range.
function source(sizes: number[]) {
	const reads: PageOptions[] = [];
	const position = (cursor: string | null | undefined) => (cursor ? Number(cursor) : 0);
	function readPage(options: PageOptions): Promise<Page<number>> {
		reads.push(options);
		const start = position(options.cursor);
		const end =
			options.endCursor === undefined || options.endCursor === null
				? Math.min(start + options.numItems, sizes.length)
				: position(options.endCursor);
		const rows = sizes.slice(start, end).map((_, index) => start + index);
		const bytes = sizes.slice(start, end).reduce((sum, size) => sum + size, 0);
		const base = { continueCursor: String(end), isDone: end === sizes.length };
		if (options.maximumBytesRead !== undefined && bytes > options.maximumBytesRead) {
			const split = rows.length > 1 ? String(start + Math.floor(rows.length / 2)) : null;
			return Promise.resolve({
				...base,
				page: rows.slice(0, 1),
				pageStatus: 'SplitRequired',
				splitCursor: split
			});
		}
		return Promise.resolve({ ...base, page: rows });
	}
	return { readPage, reads };
}

const mib = 1024 * 1024;

describe('readAllPages', () => {
	test('reads every page in order', async () => {
		const { readPage } = source(Array<number>(7).fill(10));

		expect(await readAllPages(readPage, { numItems: 3 })).toEqual([0, 1, 2, 3, 4, 5, 6]);
	});

	test('splits a page too large to read at once until every row is read once', async () => {
		const { readPage, reads } = source([3 * mib, 3 * mib, 3 * mib, 3 * mib, 10, 10, 3 * mib]);

		expect(await readAllPages(readPage, { numItems: 5 })).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(reads.every((read) => read.maximumBytesRead !== undefined)).toBe(true);
	});
});
