import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/** The Payee with this exact trimmed name, if there is one. */
export async function findPayeeNamed(ctx: QueryCtx, name: string): Promise<Doc<'payees'> | null> {
	const trimmed = name.trim();
	if (trimmed === '') return null;
	return await ctx.db
		.query('payees')
		.withIndex('by_name', (q) => q.eq('name', trimmed))
		.first();
}

/** The Payee with this exact trimmed name, created on first use; none for a blank name. */
export async function payeeNamed(
	ctx: MutationCtx,
	name: string
): Promise<Id<'payees'> | undefined> {
	const trimmed = name.trim();
	if (trimmed === '') return undefined;
	const existing = await findPayeeNamed(ctx, trimmed);
	return existing?._id ?? (await ctx.db.insert('payees', { name: trimmed }));
}

/**
 * The Category a Payee's Transactions were last given, unless it has since been deleted. A Payment
 * Category only holds its own card's starting debt, so it is never offered for another Transaction.
 */
export async function lastCategoryOf(
	ctx: QueryCtx,
	payee: Doc<'payees'>
): Promise<Id<'categories'> | undefined> {
	if (payee.lastCategoryId === undefined) return undefined;
	const category = await ctx.db.get('categories', payee.lastCategoryId);
	return category === null || category.kind === 'creditCardPayment' ? undefined : category._id;
}

/** Payee memory: a Transaction with this Payee was just given this Category. */
export async function rememberCategory(
	ctx: MutationCtx,
	payeeId: Id<'payees'>,
	categoryId: Id<'categories'>
) {
	const payee = await ctx.db.get('payees', payeeId);
	if (payee !== null && payee.lastCategoryId !== categoryId) {
		await ctx.db.patch('payees', payeeId, { lastCategoryId: categoryId });
	}
}

/** Rename memory: imports with exactly this Bank Text arrive under this Payee from now on. */
export async function rememberRename(ctx: MutationCtx, bankText: string, payeeId: Id<'payees'>) {
	const existing = await renameOf(ctx, bankText);
	if (existing === null) {
		await ctx.db.insert('payeeRenames', { bankText, payeeId });
	} else if (existing.payeeId !== payeeId) {
		await ctx.db.patch('payeeRenames', existing._id, { payeeId });
	}
}

export interface ImportedPayee {
	payeeId?: Id<'payees'>;
	categoryId?: Id<'categories'>;
}

/**
 * The Payee and Category an imported Transaction arrives with. The Payee comes from rename memory
 * for the exact Bank Text, then the bank's merchant name when it has one (file rows never do), then
 * the Bank Text. The Category comes from Payee memory, or is left out for Uncategorized. Pass the
 * same `resolved` map for every row of one import, so rows with the same Bank Text and merchant
 * name read the Payee only once.
 */
export async function importedPayee(
	ctx: MutationCtx,
	row: { bankText: string; merchantName?: string | undefined },
	resolved = new Map<string, ImportedPayee>()
): Promise<ImportedPayee> {
	const merchantName = row.merchantName?.trim() ?? '';
	const key = JSON.stringify([row.bankText, merchantName]);
	const known = resolved.get(key);
	if (known !== undefined) return known;
	const result = await resolveImportedPayee(ctx, row.bankText, merchantName);
	resolved.set(key, result);
	return result;
}

async function resolveImportedPayee(
	ctx: MutationCtx,
	bankText: string,
	merchantName: string
): Promise<ImportedPayee> {
	const rename = await renameOf(ctx, bankText);
	let payee = rename === null ? null : await ctx.db.get('payees', rename.payeeId);
	if (payee === null) {
		const name = (merchantName === '' ? bankText : merchantName).trim();
		if (name === '') return {};
		payee = await findPayeeNamed(ctx, name);
		// A Payee new to Budge has no Category to remember.
		if (payee === null) return { payeeId: await ctx.db.insert('payees', { name }) };
	}
	const categoryId = await lastCategoryOf(ctx, payee);
	return { payeeId: payee._id, ...(categoryId === undefined ? {} : { categoryId }) };
}

async function renameOf(ctx: QueryCtx, bankText: string) {
	return await ctx.db
		.query('payeeRenames')
		.withIndex('by_bankText', (q) => q.eq('bankText', bankText))
		.unique();
}
