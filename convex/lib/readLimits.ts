export type Rows<T> = AsyncIterable<T> & { take: (n: number) => Promise<T[]> };

export type ReadRows<R extends string> = <T>(read: R, rows: Rows<T>) => Promise<T[]>;

export async function everyRow<T>(_read: string, rows: Rows<T>): Promise<T[]> {
	const all: T[] = [];
	for await (const row of rows) all.push(row);
	return all;
}

export interface LimitedReads<R extends string> {
	read: ReadRows<R>;
	reached: () => { read: R; limit: number } | null;
}

export function readWithin<R extends string>(limits: Readonly<Record<R, number>>): LimitedReads<R> {
	const used = new Map<R, number>();
	let reached: { read: R; limit: number } | null = null;
	return {
		read: async (read, rows) => {
			if (reached !== null) return [];
			const left = limits[read] - (used.get(read) ?? 0);
			const taken = await rows.take(left + 1);
			if (taken.length > left) {
				reached = { read, limit: limits[read] };
				return [];
			}
			used.set(read, (used.get(read) ?? 0) + taken.length);
			return taken;
		},
		reached: () => reached
	};
}
