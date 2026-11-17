import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { readAgentConfig } from './config';

const MONEY_NOTE =
	'Amounts are dollars; negative amounts are outflows. Every Category, Account, and Transaction carries its ID.';

function localDate(now = new Date()) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function answer(text: string, isError = false) {
	return { content: [{ type: 'text' as const, text }], isError };
}

async function readBudge(
	path: string,
	parameters: Record<string, string | number | boolean | undefined>
) {
	const config = readAgentConfig();
	if (config === undefined) {
		return answer(
			'Budge agent access is not set up. Ask the owner to run `bun run agent setup`.',
			true
		);
	}
	const url = new URL(path, config.siteUrl);
	for (const [name, value] of Object.entries(parameters)) {
		if (value !== undefined) url.searchParams.set(name, String(value));
	}
	const response = await fetch(url, { headers: { authorization: `Bearer ${config.key}` } });
	if (response.status === 401) {
		return answer(
			'Budge refused the Agent Key. Ask the owner to run `bun run agent rotate`.',
			true
		);
	}
	const body = await response.text();
	return response.ok
		? answer(body)
		: answer(`Budge answered ${String(response.status)}: ${body}`, true);
}

const isoMonth = z.string().regex(/^\d{4}-\d{2}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export function serveAgentTools() {
	const server = new McpServer({ name: 'budge', version: '1.0.0' });
	const readOnly = { readOnlyHint: true, openWorldHint: false };

	server.registerTool(
		'budge_budget_month',
		{
			title: 'Budge budget month',
			description: `The owner's budget for one month: Ready to Assign, each Category Group and Category with Assigned, Activity, Available, and Target, hidden Categories, Overspending, and upcoming Targets. ${MONEY_NOTE}`,
			inputSchema: { month: isoMonth.optional().describe('YYYY-MM; defaults to this month') },
			annotations: readOnly
		},
		async ({ month }) =>
			await readBudge('/agent/budget', {
				month: month ?? localDate().slice(0, 7),
				today: localDate()
			})
	);

	server.registerTool(
		'budge_accounts',
		{
			title: 'Budge Accounts',
			description: `The owner's Accounts with kind (cash or creditCard), balance, and last Reconciliation date. ${MONEY_NOTE}`,
			annotations: readOnly
		},
		async () => await readBudge('/agent/accounts', {})
	);

	server.registerTool(
		'budge_transactions',
		{
			title: 'Budge Transactions',
			description: `One page of the owner's Transactions, newest first (best matches first when you pass search). Each row has date, kind (normal, split, transfer, startingBalance), Account, Payee, Category, amount, memo, cleared, reconciled, approved, split lines, transfer Account, and Bank Text. Pass nextCursor back as cursor for the next page. ${MONEY_NOTE}`,
			inputSchema: {
				from: isoDate.optional().describe('first date, YYYY-MM-DD'),
				to: isoDate.optional().describe('last date, YYYY-MM-DD'),
				accountId: z.string().optional(),
				categoryId: z.string().optional(),
				splitLines: z
					.literal(true)
					.optional()
					.describe('with categoryId: split Transactions that have a line in that Category'),
				uncategorized: z.literal(true).optional().describe('only Uncategorized Transactions'),
				approval: z.enum(['approved', 'unapproved']).optional(),
				search: z.string().optional().describe('words in Payee, memo, or Bank Text'),
				limit: z.number().int().min(1).max(100).optional().describe('rows per page, default 50'),
				cursor: z.string().optional()
			},
			annotations: readOnly
		},
		async (filters) => await readBudge('/agent/transactions', filters)
	);

	return server.connect(new StdioServerTransport());
}
