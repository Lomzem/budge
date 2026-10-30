import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
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

// Every source table in the schema. A new table joins on its own.
const exportable = (Object.keys(schema.tables) as TableNames[]).filter(
	(table) => !rebuildable.includes(table)
);
const exportableTable = v.union(...exportable.map((table) => v.literal(table)));

/** The tables an export holds, in schema order. */
export const tables = query({
	args: {},
	returns: v.array(exportableTable),
	handler: async (ctx) => {
		await requireOwner(ctx);
		return exportable;
	}
});

/**
 * One page of one exportable table's documents. The export reads every page of every table, so
 * no single read meets Convex's per-query limits however large the budget grows.
 */
export const page = query({
	args: {
		table: exportableTable,
		paginationOpts: paginationOptsValidator
	},
	returns: paginationResultValidator(v.any()),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const omitted = secretFields[args.table] ?? [];
		const result = await ctx.db.query(args.table).paginate(args.paginationOpts);
		return {
			...result,
			page: result.page.map((document) =>
				Object.fromEntries(Object.entries(document).filter(([key]) => !omitted.includes(key)))
			)
		};
	}
});
