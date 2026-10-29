import { v } from 'convex/values';

import type { TableNames } from './_generated/dataModel';
import { query } from './_generated/server';
import { requireOwner } from './lib/owner';
import schema from './schema';

// `monthlyTotals` can be rebuilt from Transactions, so a backup leaves it out.
const rebuildable: readonly string[] = ['monthlyTotals'];

// Fields an export never holds, by table. A Bank Connection's `provider` holds its encrypted
// token, so a backup file can't read the bank.
const secretFields: Readonly<Record<string, readonly string[]>> = {
	bankConnections: ['provider']
};

/** Every source table in the schema, as documents by table name. A new table joins on its own. */
export const all = query({
	args: {},
	returns: v.record(v.string(), v.array(v.any())),
	handler: async (ctx) => {
		await requireOwner(ctx);
		const tables = (Object.keys(schema.tables) as TableNames[]).filter(
			(table) => !rebuildable.includes(table)
		);
		const exported: Record<string, Record<string, unknown>[]> = {};
		for (const table of tables) {
			const omitted = secretFields[table] ?? [];
			// The owner asked for everything, and one owner's budget fits in one read.
			const documents = await ctx.db.query(table).collect();
			exported[table] = documents.map((document) =>
				Object.fromEntries(Object.entries(document).filter(([key]) => !omitted.includes(key)))
			);
		}
		return exported;
	}
});
