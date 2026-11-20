import { v, type Infer } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { env, httpAction, internalQuery, type QueryCtx } from './_generated/server';
import { accountRows, readAccounts } from './accounts';
import type { ApplyAnswer, RecentProposals, UndoAnswer } from './agentProposals';
import { budgetMonth, readBudget } from './budget';
import { admitsAgentKey } from './lib/agentKey';
import { readReadyToAssign } from './lib/categories';
import {
	parseEmptyQuery,
	parseBudgetQuery,
	parseTransactionsQuery,
	type Refusal
} from './lib/agentQuery';
import { accountsForAgent, budgetForAgent, transactionsForAgent } from './lib/agentWire';
import { readTransactions, transactionPage } from './transactions';

export const accounts = internalQuery({
	args: {},
	returns: accountRows,
	handler: async (ctx) => await readAccounts(ctx)
});

const agentBudgetMonth = v.object({
	...budgetMonth.fields,
	readyToAssignId: v.union(v.id('categories'), v.null())
});

export const budget = internalQuery({
	args: { month: v.string(), today: v.string() },
	returns: agentBudgetMonth,
	handler: async (ctx, args) => ({
		...(await readBudget(ctx, args.month, args.today)),
		readyToAssignId: (await readReadyToAssign(ctx))?._id ?? null
	})
});

async function existingId<Table extends 'accounts' | 'categories'>(
	ctx: QueryCtx,
	table: Table,
	text: string | undefined
): Promise<Id<Table> | undefined | null> {
	if (text === undefined) return undefined;
	const id = ctx.db.normalizeId(table, text);
	if (id === null) return null;
	return (await ctx.db.get(table, id)) === null ? null : id;
}

const transactionsAnswer = v.union(v.object({ refused: v.string() }), transactionPage);

type TransactionsAnswer = Infer<typeof transactionsAnswer>;

export const transactions = internalQuery({
	args: { parameters: v.string() },
	returns: transactionsAnswer,
	handler: async (ctx, { parameters }): Promise<TransactionsAnswer> => {
		const parsed = parseTransactionsQuery(new URLSearchParams(parameters));
		if ('refused' in parsed) return parsed;
		const { accountId, categoryId, ...filters } = parsed;
		const account = await existingId(ctx, 'accounts', accountId);
		if (account === null) return { refused: 'No Account has that accountId.' };
		const category = await existingId(ctx, 'categories', categoryId);
		if (category === null) return { refused: 'No Category has that categoryId.' };
		return await readTransactions(ctx, { ...filters, accountId: account, categoryId: category });
	}
});

function json(body: unknown) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

function refuse({ refused }: Refusal) {
	return new Response(refused, { status: 400, headers: { 'content-type': 'text/plain' } });
}

const BODY_BYTE_LIMIT = 64 * 1024;

const tooLarge = () =>
	new Response(`The request body is larger than ${String(BODY_BYTE_LIMIT / 1024)} KiB.`, {
		status: 413,
		headers: { 'content-type': 'text/plain' }
	});

async function boundedText(request: Request) {
	const reader = request.body?.getReader();
	if (reader === undefined) return '';
	const decoder = new TextDecoder();
	let text = '';
	let size = 0;
	for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
		size += chunk.value.byteLength;
		if (size > BODY_BYTE_LIMIT) {
			await reader.cancel();
			return null;
		}
		text += decoder.decode(chunk.value, { stream: true });
	}
	return text + decoder.decode();
}

type HttpCtx = Parameters<Parameters<typeof httpAction>[0]>[0];

function agentRoute(
	answer: (ctx: HttpCtx, query: URLSearchParams, request: Request) => Promise<Response>
) {
	return httpAction(async (ctx, request) => {
		const admitted = await admitsAgentKey(
			request.headers.get('authorization'),
			env.BUDGE_AGENT_KEY_SHA256
		);
		if (!admitted) return new Response(null, { status: 401 });
		return await answer(ctx, new URL(request.url).searchParams, request);
	});
}

export const accountsRoute = agentRoute(async (ctx, query) => {
	const refusal = parseEmptyQuery(query);
	if (refusal !== null) return refuse(refusal);
	return json(accountsForAgent(await ctx.runQuery(internal.agent.accounts, {})));
});

export const budgetRoute = agentRoute(async (ctx, query) => {
	const parsed = parseBudgetQuery(query);
	if ('refused' in parsed) return refuse(parsed);
	return json(budgetForAgent(await ctx.runQuery(internal.agent.budget, parsed)));
});

export const transactionsRoute = agentRoute(async (ctx, query) => {
	const page: TransactionsAnswer = await ctx.runQuery(internal.agent.transactions, {
		parameters: query.toString()
	});
	if ('refused' in page) return refuse(page);
	return json(transactionsForAgent(page));
});

export const applyProposalRoute = agentRoute(async (ctx, _query, request) => {
	const body = await boundedText(request);
	if (body === null) return tooLarge();
	const answer: ApplyAnswer = await ctx.runMutation(internal.agentProposals.apply, { body });
	if ('refused' in answer) return refuse(answer);
	return json(answer);
});

export const undoProposalRoute = agentRoute(async (ctx, _query, request) => {
	const body = await boundedText(request);
	if (body === null) return tooLarge();
	const answer: UndoAnswer = await ctx.runMutation(internal.agentProposals.undo, { body });
	if ('refused' in answer) return refuse(answer);
	return json(answer);
});

export const recentProposalsRoute = agentRoute(async (ctx, query) => {
	const refusal = parseEmptyQuery(query);
	if (refusal !== null) return refuse(refusal);
	const recent: RecentProposals = await ctx.runQuery(internal.agentProposals.recent, {});
	return json(recent);
});
