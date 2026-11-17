import { v, type Infer } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery, type MutationCtx } from './_generated/server';
import type { Refusal } from './lib/agentQuery';
import {
	parseProposal,
	parseProposalId,
	proposalOutcome,
	type NewCategory,
	type Proposal,
	type ProposalOutcome,
	type ProposedChange
} from './lib/agentProposal';
import { insertCategory, insertGroup } from './lib/categories';
import { categoriesCutoverUndoNeeds } from './lib/laterCutover';
import { publicError } from './lib/publicError';
import { categorizeTransaction, recategorizeSplitLine, splitLinesOf } from './lib/transactions';

const refusal = v.object({ refused: v.string() });

const appliedProposal = v.object({
	id: v.string(),
	changes: v.array(
		v.object({
			transactionId: v.id('transactions'),
			line: v.union(v.number(), v.null()),
			outcome: proposalOutcome
		})
	),
	created: v.object({
		groups: v.array(v.object({ id: v.id('categoryGroups'), name: v.string() })),
		categories: v.array(v.object({ id: v.id('categories'), name: v.string() }))
	}),
	undone: v.boolean()
});

export type ApplyAnswer = Infer<typeof refusal> | Infer<typeof appliedProposal>;

type RecordedChange = Doc<'agentProposals'>['changes'][number];

type Created<T extends 'categoryGroups' | 'categories'> = { id: Id<T>; name: string }[];

interface ResolvedChange {
	transactionId: Id<'transactions'>;
	line?: number | undefined;
	fromCategoryId: Id<'categories'> | null;
	to: { categoryId: Id<'categories'> } | { newCategory: string };
}

interface ResolvedCategory {
	name: string;
	group: { groupId: Id<'categoryGroups'> } | { newGroup: string };
}

function resolveChange(
	ctx: MutationCtx,
	change: ProposedChange,
	index: number
): ResolvedChange | Refusal {
	const where = `changes[${String(index)}]`;
	const transactionId = ctx.db.normalizeId('transactions', change.transactionId);
	if (transactionId === null) return { refused: `${where}.transactionId is not a Transaction ID.` };
	const fromCategoryId =
		change.fromCategoryId === null ? null : ctx.db.normalizeId('categories', change.fromCategoryId);
	if (fromCategoryId === null && change.fromCategoryId !== null) {
		return { refused: `${where}.fromCategoryId is not a Category ID.` };
	}
	const base = { transactionId, line: change.line, fromCategoryId };
	if ('newCategory' in change.to) return { ...base, to: change.to };
	const toCategoryId = ctx.db.normalizeId('categories', change.to.categoryId);
	if (toCategoryId === null) return { refused: `${where}.toCategoryId is not a Category ID.` };
	return { ...base, to: { categoryId: toCategoryId } };
}

async function resolveNewCategory(
	ctx: MutationCtx,
	category: NewCategory,
	index: number
): Promise<ResolvedCategory | Refusal> {
	if ('newGroup' in category.group) return { name: category.name, group: category.group };
	const groupId = ctx.db.normalizeId('categoryGroups', category.group.groupId);
	const group = groupId === null ? null : await ctx.db.get('categoryGroups', groupId);
	if (group?.kind !== 'normal' || group.hidden === true) {
		return {
			refused: `newCategories[${String(index)}].groupId is not a Category Group you can add to.`
		};
	}
	return { name: category.name, group: { groupId: group._id } };
}

async function nameClash(ctx: MutationCtx, names: readonly string[]): Promise<Refusal | null> {
	const proposed = new Map(names.map((name) => [name.toLowerCase(), name]));
	for await (const group of ctx.db.query('categoryGroups')) {
		const name = proposed.get(group.name.toLowerCase());
		if (name !== undefined) return { refused: `${name} is already a Category Group's name.` };
	}
	for await (const category of ctx.db.query('categories')) {
		const name = proposed.get(category.name.toLowerCase());
		if (name !== undefined) return { refused: `${name} is already a Category's name.` };
	}
	return null;
}

async function createNamed(
	ctx: MutationCtx,
	newGroups: readonly string[],
	newCategories: readonly ResolvedCategory[]
) {
	const groups: Created<'categoryGroups'> = [];
	for (const name of newGroups) groups.push({ id: await insertGroup(ctx, name), name });
	const groupIdOf = (name: string) =>
		groups.find((group) => group.name.toLowerCase() === name.toLowerCase())?.id;
	const categories: Created<'categories'> = [];
	for (const { name, group } of newCategories) {
		const groupId = 'groupId' in group ? group.groupId : groupIdOf(group.newGroup);
		if (groupId === undefined) {
			throw publicError('INVALID_INPUT', `${name} names a new Group the proposal does not list.`);
		}
		categories.push({ id: await insertCategory(ctx, groupId, name), name });
	}
	return { groups, categories };
}

interface Target extends Omit<ResolvedChange, 'to'> {
	toCategoryId: Id<'categories'>;
}

function targetOf({ to, ...change }: ResolvedChange, created: Created<'categories'>): Target {
	if ('categoryId' in to) return { ...change, toCategoryId: to.categoryId };
	const name = to.newCategory.toLowerCase();
	const category = created.find((candidate) => candidate.name.toLowerCase() === name);
	if (category === undefined) {
		throw publicError('INVALID_INPUT', `${name} is a new Category the proposal does not list.`);
	}
	return { ...change, toCategoryId: category.id };
}

async function isAllowedTarget(ctx: MutationCtx, categoryId: Id<'categories'>) {
	const category = await ctx.db.get('categories', categoryId);
	if (category?.kind !== 'normal' || category.hidden === true) return false;
	const group = await ctx.db.get('categoryGroups', category.groupId);
	return group !== null && group.hidden !== true;
}

async function applyToLine(
	ctx: MutationCtx,
	transaction: Doc<'transactions'>,
	change: Target,
	line: number
): Promise<ProposalOutcome> {
	if (transaction.split !== true) return 'changed';
	const lines = await splitLinesOf(ctx, transaction._id);
	if (lines[line]?.categoryId !== change.fromCategoryId) return 'changed';
	await recategorizeSplitLine(ctx, transaction, line, change.toCategoryId);
	return 'applied';
}

async function applyChange(ctx: MutationCtx, change: Target): Promise<ProposalOutcome> {
	const transaction = await ctx.db.get('transactions', change.transactionId);
	if (transaction === null) return 'changed';
	if (transaction.transferTransactionId !== undefined) return 'transfer';
	if (transaction.kind === 'startingBalance') return 'startingBalance';
	if (!(await isAllowedTarget(ctx, change.toCategoryId))) return 'notAllowed';
	if (change.line !== undefined) return await applyToLine(ctx, transaction, change, change.line);
	if (transaction.split === true) return 'split';
	if ((transaction.categoryId ?? null) !== change.fromCategoryId) return 'changed';
	await categorizeTransaction(ctx, transaction, {
		kind: 'category',
		categoryId: change.toCategoryId
	});
	return 'applied';
}

async function recordOf(ctx: MutationCtx, proposalId: string) {
	return await ctx.db
		.query('agentProposals')
		.withIndex('by_proposalId', (q) => q.eq('proposalId', proposalId))
		.unique();
}

function answerOf(
	proposal: Omit<Doc<'agentProposals'>, '_id' | '_creationTime'>
): Infer<typeof appliedProposal> {
	return {
		id: proposal.proposalId,
		changes: proposal.changes.map(({ transactionId, line, outcome }) => ({
			transactionId,
			line: line ?? null,
			outcome
		})),
		created: { groups: proposal.createdGroups, categories: proposal.createdCategories },
		undone: proposal.undo !== undefined
	};
}

async function resolveAll(
	ctx: MutationCtx,
	proposal: Proposal
): Promise<{ changes: ResolvedChange[]; newCategories: ResolvedCategory[] } | Refusal> {
	const changes: ResolvedChange[] = [];
	for (const [index, change] of proposal.changes.entries()) {
		const answer = resolveChange(ctx, change, index);
		if ('refused' in answer) return answer;
		changes.push(answer);
	}
	const newCategories: ResolvedCategory[] = [];
	for (const [index, category] of proposal.newCategories.entries()) {
		const answer = await resolveNewCategory(ctx, category, index);
		if ('refused' in answer) return answer;
		newCategories.push(answer);
	}
	const clash = await nameClash(ctx, [
		...proposal.newGroups,
		...proposal.newCategories.map((category) => category.name)
	]);
	return clash ?? { changes, newCategories };
}

export const apply = internalMutation({
	args: { body: v.string() },
	returns: v.union(refusal, appliedProposal),
	handler: async (ctx, { body }): Promise<ApplyAnswer> => {
		const proposal = parseProposal(body);
		if ('refused' in proposal) return proposal;
		const earlier = await recordOf(ctx, proposal.id);
		if (earlier !== null) return answerOf(earlier);
		const resolved = await resolveAll(ctx, proposal);
		if ('refused' in resolved) return resolved;
		const created = await createNamed(ctx, proposal.newGroups, resolved.newCategories);
		const changes: RecordedChange[] = [];
		for (const change of resolved.changes) {
			const { line, ...target } = targetOf(change, created.categories);
			const outcome = await applyChange(ctx, { ...target, line });
			changes.push({ ...target, ...(line === undefined ? {} : { line }), outcome });
		}
		const recorded = {
			proposalId: proposal.id,
			changes,
			createdGroups: created.groups,
			createdCategories: created.categories
		};
		await ctx.db.insert('agentProposals', recorded);
		return answerOf(recorded);
	}
});

const undoAnswer = v.object({
	id: v.string(),
	restored: v.number(),
	keptTransactionIds: v.array(v.id('transactions')),
	removedCategories: v.array(v.string()),
	removedGroups: v.array(v.string())
});

export type UndoAnswer = Infer<typeof refusal> | Infer<typeof undoAnswer>;

async function restoreChange(ctx: MutationCtx, change: RecordedChange): Promise<boolean> {
	const transaction = await ctx.db.get('transactions', change.transactionId);
	if (transaction === null) return false;
	const from = change.fromCategoryId;
	if (from !== null && (await ctx.db.get('categories', from)) === null) return false;
	if (change.line !== undefined) {
		if (transaction.split !== true || from === null) return false;
		const lines = await splitLinesOf(ctx, transaction._id);
		if (lines[change.line]?.categoryId !== change.toCategoryId) return false;
		await recategorizeSplitLine(ctx, transaction, change.line, from);
		return true;
	}
	if (transaction.split === true || transaction.categoryId !== change.toCategoryId) return false;
	await categorizeTransaction(
		ctx,
		transaction,
		from === null ? { kind: 'uncategorized' } : { kind: 'category', categoryId: from }
	);
	return true;
}

async function isInUse(ctx: MutationCtx, categoryId: Id<'categories'>) {
	const category = await ctx.db.get('categories', categoryId);
	if (category === null) return false;
	if (category.target !== undefined) return true;
	const uses = [
		ctx.db
			.query('transactions')
			.withIndex('by_category_date', (q) => q.eq('categoryId', categoryId))
			.first(),
		ctx.db
			.query('transactionSplits')
			.withIndex('by_category_date', (q) => q.eq('categoryId', categoryId))
			.first(),
		ctx.db
			.query('assignments')
			.withIndex('by_category_month', (q) => q.eq('categoryId', categoryId))
			.first()
	];
	if ((await Promise.all(uses)).some((use) => use !== null)) return true;
	for await (const payee of ctx.db.query('payees')) {
		if (payee.lastCategoryId === categoryId) return true;
	}
	return false;
}

async function removeUnused(ctx: MutationCtx, proposal: Doc<'agentProposals'>) {
	const removedCategories: string[] = [];
	const cutoverUndoNeeds = await categoriesCutoverUndoNeeds(ctx);
	for (const { id, name } of proposal.createdCategories) {
		if (cutoverUndoNeeds.has(id) || (await ctx.db.get('categories', id)) === null) continue;
		if (await isInUse(ctx, id)) continue;
		await ctx.db.delete('categories', id);
		removedCategories.push(name);
	}
	const removedGroups: string[] = [];
	for (const { id, name } of proposal.createdGroups) {
		if ((await ctx.db.get('categoryGroups', id)) === null) continue;
		const member = await ctx.db
			.query('categories')
			.withIndex('by_group_position', (q) => q.eq('groupId', id))
			.first();
		if (member !== null) continue;
		await ctx.db.delete('categoryGroups', id);
		removedGroups.push(name);
	}
	return { removedCategories, removedGroups };
}

export const undo = internalMutation({
	args: { body: v.string() },
	returns: v.union(refusal, undoAnswer),
	handler: async (ctx, { body }): Promise<UndoAnswer> => {
		const asked = parseProposalId(body);
		if ('refused' in asked) return asked;
		const proposal = await recordOf(ctx, asked.id);
		if (proposal === null) return { refused: 'No applied proposal has that id.' };
		if (proposal.undo !== undefined) return { id: proposal.proposalId, ...proposal.undo };
		let restored = 0;
		const keptTransactionIds: Id<'transactions'>[] = [];
		for (const change of proposal.changes) {
			if (change.outcome !== 'applied') continue;
			if (await restoreChange(ctx, change)) restored += 1;
			else keptTransactionIds.push(change.transactionId);
		}
		const result = { restored, keptTransactionIds, ...(await removeUnused(ctx, proposal)) };
		await ctx.db.patch('agentProposals', proposal._id, { undo: result });
		return { id: proposal.proposalId, ...result };
	}
});

const RECENT_PROPOSAL_LIMIT = 20;

const recentProposals = v.object({
	proposals: v.array(
		v.object({
			id: v.string(),
			appliedAt: v.string(),
			applied: v.number(),
			refused: v.number(),
			undone: v.boolean()
		})
	)
});

export type RecentProposals = Infer<typeof recentProposals>;

export const recent = internalQuery({
	args: {},
	returns: recentProposals,
	handler: async (ctx): Promise<RecentProposals> => {
		const records = await ctx.db.query('agentProposals').order('desc').take(RECENT_PROPOSAL_LIMIT);
		return {
			proposals: records.map((record) => {
				const applied = record.changes.filter((change) => change.outcome === 'applied').length;
				return {
					id: record.proposalId,
					appliedAt: new Date(record._creationTime).toISOString(),
					applied,
					refused: record.changes.length - applied,
					undone: record.undo !== undefined
				};
			})
		};
	}
});
