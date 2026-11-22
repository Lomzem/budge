import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { NEW_NAME_LIMIT, PROPOSAL_CHANGE_LIMIT, PROPOSAL_ID } from '../../convex/lib/agentProposal';
import { TRANSACTIONS_LIMIT } from '../../convex/lib/agentQuery';
import { MATCH_WINDOW_DAYS } from '../../src/lib/domain/matcher';

import { agentCommand, readAgentConfig } from './config';

const MONEY_NOTE =
	'Amounts are dollars; negative amounts are outflows. Every Category, Account, and Transaction carries its ID.';

function localDate(now = new Date()) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function answer(text: string, isError = false) {
	return { content: [{ type: 'text' as const, text }], isError };
}

type Parameters = Record<string, string | number | boolean | undefined>;

async function callBudge(path: string, request: { parameters?: Parameters; body?: unknown }) {
	const config = readAgentConfig();
	if (config === undefined) {
		return answer(
			'Budge agent access is not set up. Ask the owner to run `bun run agent setup`.',
			true
		);
	}
	const url = new URL(path, config.siteUrl);
	for (const [name, value] of Object.entries(request.parameters ?? {})) {
		if (value !== undefined) url.searchParams.set(name, String(value));
	}
	const authorization = `Bearer ${config.key}`;
	const response = await fetch(
		url,
		request.body === undefined
			? { headers: { authorization } }
			: {
					method: 'POST',
					headers: { authorization, 'content-type': 'application/json' },
					body: JSON.stringify(request.body)
				}
	);
	if (response.status === 401) {
		return answer(
			`Budge refused the Agent Key. Ask the owner to run ${agentCommand('setup', config.target)} to issue a new one.`,
			true
		);
	}
	const body = await response.text();
	return response.ok
		? answer(body)
		: answer(`Budge answered ${String(response.status)}: ${body}`, true);
}

async function readBudge(path: string, parameters: Parameters) {
	return await callBudge(path, { parameters });
}

const readOnly = { readOnlyHint: true, openWorldHint: false };

const isoMonth = z.string().regex(/^\d{4}-\d{2}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const proposalId = z
	.string()
	.regex(PROPOSAL_ID)
	.describe('an ID you choose for this proposal: letters, digits, and . _ : -');

const APPLY_DESCRIPTION = [
	'Apply a Categorization Proposal the owner approved. Call it only after you showed the owner every change and Transfer link in chat and the owner said yes to it; never apply anything the owner has not seen.',
	'Propose only changes you are sure of. List Transactions you are unsure of as questions to the owner instead of guessing.',
	'Each item in changes names a Transaction, the Category you read for it (fromCategoryId, null when it had none), and either an existing toCategoryId or a toNewCategory listed in newCategories. Inflows (positive amounts) may target Ready to Assign using readyToAssign.id from budge_budget_month; outflows cannot. For a split Transaction, give line: the position of the split line in the splits you read, counting from 0.',
	`Each item in transfers links two imported Transactions (such as a card payment) as one Transfer, naming first and second with each side’s transactionId and revision from budge_transactions. Both sides must be imported Transactions (each with a Bank Row) in different Accounts (at least one Cash Account; card payments move money out of a Cash Account) with opposite amounts within ${String(MATCH_WINDOW_DAYS)} days, and neither may already be a Transfer, Split, or Starting Balance. The linked Transfer takes first’s date and memo and keeps both Accounts’ balances, Cleared status, approval, and Bank Rows.`,
	`Prefer existing Categories. A new Category or Category Group whose name matches an existing one, ignoring case, refuses the whole proposal. A proposal must list at least one item across changes and transfers, up to ${String(PROPOSAL_CHANGE_LIMIT)} total.`,
	'Budge never changes Remembered Categories or approval; category changes keep amount, date, Account, Payee, and split amounts as they are.',
	'Each change answers with an outcome: applied; changed (the Transaction or split line no longer has the Category you read, or no longer exists; read it again); transfer and startingBalance (these take no Category); split (name a line); notAllowed (the target is hidden, in a hidden Group, removed, a Credit Card Payment Category, or Ready to Assign for a non-inflow). Each transfer answers with: applied; changed (either side is gone or changed since read); transfer, startingBalance, or split (either side is one); notEligible (failed Transfer eligibility or second is Reconciled on a different date).',
	'Sending the same id again answers with the first result and changes nothing, so retry with the same id after a failure.'
].join(' ');

const transferSide = z.object({
	transactionId: z.string(),
	revision: z.string().describe('revision returned by budge_transactions')
});

function registerProposalTools(server: McpServer) {
	server.registerTool(
		'budge_apply_proposal',
		{
			title: 'Apply a Budge Categorization Proposal',
			description: APPLY_DESCRIPTION,
			inputSchema: {
				id: proposalId,
				newGroups: z
					.array(z.string())
					.max(NEW_NAME_LIMIT)
					.optional()
					.describe('new Category Group names'),
				newCategories: z
					.array(
						z.object({
							name: z.string(),
							groupId: z.string().optional().describe('an existing Category Group'),
							newGroup: z.string().optional().describe('a name from newGroups')
						})
					)
					.max(NEW_NAME_LIMIT)
					.optional(),
				changes: z
					.array(
						z.object({
							transactionId: z.string(),
							line: z.number().int().min(0).optional().describe('split line position, from 0'),
							fromCategoryId: z.string().nullable(),
							toCategoryId: z.string().optional(),
							toNewCategory: z.string().optional().describe('a name from newCategories')
						})
					)
					.max(PROPOSAL_CHANGE_LIMIT)
					.optional(),
				transfers: z
					.array(
						z.object({
							first: transferSide.describe(
								'imported Transaction whose date and memo the Transfer keeps'
							),
							second: transferSide.describe('matching imported Transaction in the other Account')
						})
					)
					.max(PROPOSAL_CHANGE_LIMIT)
					.optional()
					.describe('pairs of imported Transactions to link as Transfers')
			},
			annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false }
		},
		async (proposal) => await callBudge('/agent/proposals', { body: proposal })
	);

	server.registerTool(
		'budge_undo_proposal',
		{
			title: 'Undo a Budge Categorization Proposal',
			description:
				"Undo an applied Categorization Proposal when the owner asks. Budge restores only the Transactions that still have the Category the proposal gave them and the linked Transfer pairs whose sides still match the applied result; it keeps the owner's later changes and reports them in keptTransactionIds. It removes the new Categories and Category Groups the proposal added unless something now uses them. Undoing the same id again answers with the first result.",
			inputSchema: { id: proposalId },
			annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false }
		},
		async ({ id }) => await callBudge('/agent/proposals/undo', { body: { id } })
	);

	server.registerTool(
		'budge_proposals',
		{
			title: 'Budge Categorization Proposals',
			description:
				'The 20 most recent applied Categorization Proposals, newest first, with when each was applied, how many changes it applied and refused, and whether it was undone. Use it to find the id of a proposal the owner wants to undo.',
			annotations: readOnly
		},
		async () => await readBudge('/agent/proposals', {})
	);
}

export function serveAgentTools() {
	const server = new McpServer({ name: 'budge', version: '1.0.0' });

	server.registerTool(
		'budge_budget_month',
		{
			title: 'Budge budget month',
			description: `The owner's budget for one month: Ready to Assign (with its Category id for inflows), each Category Group and Category with Assigned, Activity, Available, and Target, hidden Categories, Overspending, and upcoming Targets. ${MONEY_NOTE}`,
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
			description: `One page of the owner's Transactions, newest first (best matches first when you pass search). Each row has id, revision, date, kind (normal, split, transfer, startingBalance), Account, Payee, Category, amount, memo, cleared, reconciled, approved, split lines, transfer Account, and Bank Text. Pass nextCursor back as cursor for the next page. ${MONEY_NOTE}`,
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
				limit: z
					.number()
					.int()
					.min(1)
					.max(TRANSACTIONS_LIMIT)
					.optional()
					.describe('rows per page, default 50'),
				cursor: z.string().optional()
			},
			annotations: readOnly
		},
		async (filters) => await readBudge('/agent/transactions', filters)
	);

	registerProposalTools(server);

	return server.connect(new StdioServerTransport());
}
