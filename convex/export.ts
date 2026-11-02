import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { v } from 'convex/values';

import type { TableNames } from './_generated/dataModel';
import { query } from './_generated/server';
import { requireOwner } from './lib/owner';
import schema from './schema';

const rebuildable: readonly string[] = ['monthlyTotals'];

const secretFields: Readonly<Record<string, readonly string[]>> = {
	bankConnections: ['provider']
};

const exportable = (Object.keys(schema.tables) as TableNames[]).filter(
	(table) => !rebuildable.includes(table)
);
const exportableTable = v.union(...exportable.map((table) => v.literal(table)));

export const tables = query({
	args: {},
	returns: v.array(exportableTable),
	handler: async (ctx) => {
		await requireOwner(ctx);
		return exportable;
	}
});

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
