import type { FunctionArgs } from 'convex/server';

import type { api } from '$convex/_generated/api';
import type { Doc, Id } from '$convex/_generated/dataModel';

import { isIsoDate } from './domain/dates';
import { formatCents, parseCents } from './domain/money';
import { SPLIT_LINE_LIMIT } from './domain/splits';

export type Fields = FunctionArgs<typeof api.transactions.create>;

export type Direction = 'outflow' | 'inflow';

export interface Line {
	readonly key: number;
	categoryId: string;
	amount: string;
	memo: string;
}

export type Choice =
	| { readonly kind: 'uncategorized' }
	| { readonly kind: 'category'; readonly categoryId: Id<'categories'> }
	| { readonly kind: 'transfer'; readonly accountId: Id<'accounts'> }
	| { readonly kind: 'split' };

export type Selection =
	| Choice
	| { readonly kind: 'recalling' }
	| { readonly kind: 'recallFailed'; readonly message: string };

export interface Draft {
	accountId: string;
	date: string;
	payee: string;
	direction: Direction;
	amount: string;
	memo: string;
	readonly lines: Line[];
	readonly choice: Choice;
	readonly picked: boolean;
	readonly link: string | undefined;
	readonly nextLineKey: number;
	readonly filledFrom: SavedSize | null;
}

interface SavedSize {
	readonly date: string;
	readonly amount: number;
}

export interface Saved extends SavedSize {
	readonly accountId: Id<'accounts'>;
	readonly payeeName: string | null;
	readonly memo: string | null;
	readonly categoryId: Id<'categories'> | null;
	readonly categoryName: string | null;
	readonly splits:
		| readonly {
				readonly categoryId: Id<'categories'>;
				readonly categoryName: string;
				readonly amount: number;
				readonly memo: string | null;
		  }[]
		| null;
	readonly transfer: { readonly accountId: Id<'accounts'> } | null;
	readonly bankRows: readonly unknown[];
}

export interface AccountChoice {
	readonly _id: Id<'accounts'>;
	readonly name: string;
	readonly kind: Doc<'accounts'>['kind'];
}

export interface Catalog {
	readonly readyToAssignId: Id<'categories'> | null;
	readonly groups: readonly {
		readonly categories: readonly { readonly _id: Id<'categories'> }[];
	}[];
}

export type Lookup<A> =
	| { readonly kind: 'loading' }
	| { readonly kind: 'failed'; readonly stale: boolean }
	| { readonly kind: 'loaded'; readonly data: A; readonly stale: boolean };

export interface World {
	readonly saved: Saved | undefined;
	readonly accounts: readonly AccountChoice[];
	readonly categories: Lookup<Catalog>;
	readonly payeeMemory: Lookup<Id<'categories'> | null>;
}

export type Payload =
	| { readonly kind: 'waiting' }
	| { readonly kind: 'invalid'; readonly message: string }
	| { readonly kind: 'ready'; readonly fields: Fields };

export interface View<Candidate> {
	readonly selection: Selection;
	readonly transferAccounts: readonly AccountChoice[];
	readonly cardPayment: boolean;
	readonly remainder: number | undefined;
	readonly blankLine: boolean;
	readonly candidates: readonly Candidate[];
	readonly link: string;
	readonly payload: Payload;
}

export const NEW_SIDE = 'new';

const UNCATEGORIZED_OPTION = '';
const SPLIT_OPTION = 'split';
const TRANSFER_OPTION = 'transfer:';
const UNRESOLVED_OPTION = 'unresolved';

export function lookupOf<A>(query: {
	readonly data: A | undefined;
	readonly error: Error | undefined;
	readonly isStale: boolean;
}): Lookup<A> {
	if (query.error !== undefined) return { kind: 'failed', stale: query.isStale };
	if (query.data === undefined) return { kind: 'loading' };
	return { kind: 'loaded', data: query.data, stale: query.isStale };
}

function shownSize(cents: number) {
	return formatCents(Math.abs(cents)).replace('$', '');
}

function directionOf(cents: number): Direction {
	return cents < 0 ? 'outflow' : 'inflow';
}

function choiceOf(saved: Saved): Choice {
	if (saved.transfer) return { kind: 'transfer', accountId: saved.transfer.accountId };
	if (saved.splits) return { kind: 'split' };
	if (saved.categoryId !== null) return { kind: 'category', categoryId: saved.categoryId };
	return { kind: 'uncategorized' };
}

export function openDraft(start: {
	readonly saved: Saved | undefined;
	readonly defaultAccountId: Id<'accounts'> | undefined;
	readonly accounts: readonly AccountChoice[];
	readonly today: string;
}): Draft {
	const { saved } = start;
	if (saved === undefined) {
		return {
			accountId: start.defaultAccountId ?? start.accounts[0]?._id ?? '',
			date: start.today,
			payee: '',
			direction: 'outflow',
			amount: '',
			memo: '',
			lines: [],
			choice: { kind: 'uncategorized' },
			picked: false,
			link: undefined,
			nextLineKey: 0,
			filledFrom: null
		};
	}
	const sign = saved.amount < 0 ? -1 : 1;
	const lines = (saved.splits ?? []).map((line, key) => ({
		key,
		categoryId: line.categoryId,
		amount: formatCents(sign * line.amount).replace('$', ''),
		memo: line.memo ?? ''
	}));
	return {
		accountId: saved.accountId,
		date: saved.date,
		payee: saved.payeeName ?? '',
		direction: directionOf(saved.amount),
		amount: shownSize(saved.amount),
		memo: saved.memo ?? '',
		lines,
		choice: choiceOf(saved),
		picked: false,
		link: undefined,
		nextLineKey: lines.length,
		filledFrom: { date: saved.date, amount: saved.amount }
	};
}

export function followSaved(draft: Draft, live: SavedSize): Draft {
	const before = draft.filledFrom;
	if (before === null) return { ...draft, filledFrom: live };
	const dateUntouched = draft.date === before.date;
	const amountUntouched =
		draft.amount === shownSize(before.amount) && draft.direction === directionOf(before.amount);
	return {
		...draft,
		filledFrom: live,
		...(dateUntouched ? { date: live.date } : {}),
		...(amountUntouched
			? { amount: shownSize(live.amount), direction: directionOf(live.amount) }
			: {})
	};
}

function recallsCategory(draft: Draft) {
	return !draft.picked && draft.choice.kind === 'uncategorized';
}

export function recallQuery(draft: Draft): { name: string } | undefined {
	const name = draft.payee.trim();
	return recallsCategory(draft) && name !== '' ? { name } : undefined;
}

function categoryIn(world: World, id: string): Id<'categories'> | undefined {
	if (id === '') return undefined;
	const { saved } = world;
	if (saved?.categoryId === id) return saved.categoryId;
	const savedLine = saved?.splits?.find((line) => line.categoryId === id);
	if (savedLine) return savedLine.categoryId;
	if (world.categories.kind !== 'loaded') return undefined;
	const catalog = world.categories.data;
	if (id === catalog.readyToAssignId) return catalog.readyToAssignId;
	return catalog.groups.flatMap((group) => group.categories).find((c) => c._id === id)?._id;
}

function selectionOf(draft: Draft, world: World): Selection {
	if (recallQuery(draft) === undefined) return draft.choice;
	const memory = world.payeeMemory;
	if (memory.kind === 'loading' || memory.stale) return { kind: 'recalling' };
	if (memory.kind === 'failed') {
		return {
			kind: 'recallFailed',
			message: "Budge couldn't look up this Payee's last Category. Pick one to save."
		};
	}
	if (memory.data === null) return { kind: 'uncategorized' };
	if (world.categories.kind === 'loading') return { kind: 'recalling' };
	if (world.categories.kind === 'failed') {
		return {
			kind: 'recallFailed',
			message: "Budge couldn't load the Categories. Pick Uncategorized or a Transfer to save."
		};
	}
	const remembered = categoryIn(world, memory.data);
	return remembered === undefined
		? { kind: 'uncategorized' }
		: { kind: 'category', categoryId: remembered };
}

export function optionOf(selection: Selection): string {
	switch (selection.kind) {
		case 'uncategorized':
			return UNCATEGORIZED_OPTION;
		case 'category':
			return selection.categoryId;
		case 'transfer':
			return TRANSFER_OPTION + selection.accountId;
		case 'split':
			return SPLIT_OPTION;
		case 'recalling':
		case 'recallFailed':
			return UNRESOLVED_OPTION;
	}
}

function choiceFor(option: string, world: World): Choice | undefined {
	if (option === UNCATEGORIZED_OPTION) return { kind: 'uncategorized' };
	if (option === SPLIT_OPTION) return { kind: 'split' };
	if (option.startsWith(TRANSFER_OPTION)) {
		const accountId = option.slice(TRANSFER_OPTION.length);
		const account = world.accounts.find((a) => a._id === accountId);
		return account && { kind: 'transfer', accountId: account._id };
	}
	const categoryId = categoryIn(world, option);
	return categoryId && { kind: 'category', categoryId };
}

function isCash(accounts: readonly AccountChoice[], accountId: string) {
	return accounts.some((account) => account._id === accountId && account.kind === 'cash');
}

function transferAccountsOf(draft: Draft, accounts: readonly AccountChoice[]) {
	return isCash(accounts, draft.accountId)
		? accounts.filter((account) => account._id !== draft.accountId)
		: accounts.filter((account) => account.kind === 'cash');
}

function isCardPayment(draft: Draft, selection: Selection, accounts: readonly AccountChoice[]) {
	if (selection.kind !== 'transfer') return false;
	return !(isCash(accounts, draft.accountId) && isCash(accounts, selection.accountId));
}

export function choose(draft: Draft, option: string, world: World): Draft {
	const choice = choiceFor(option, world);
	if (choice === undefined) return draft;
	const previous = selectionOf(draft, world);
	let chosen: Draft = { ...draft, choice, picked: true };
	if (choice.kind === 'split') {
		const total = parseCents(draft.amount);
		const key = draft.nextLineKey;
		chosen = {
			...chosen,
			lines: [
				{
					key,
					categoryId: previous.kind === 'category' ? previous.categoryId : '',
					amount: total === undefined ? draft.amount : shownSize(total),
					memo: ''
				},
				{ key: key + 1, categoryId: '', amount: '', memo: '' }
			],
			nextLineKey: key + 2
		};
	}
	if (isCardPayment(chosen, choice, world.accounts)) {
		chosen.direction = isCash(world.accounts, chosen.accountId) ? 'outflow' : 'inflow';
	}
	return chosen;
}

export function addLine(draft: Draft): Draft {
	if (draft.lines.length >= SPLIT_LINE_LIMIT) return draft;
	const key = draft.nextLineKey;
	return {
		...draft,
		lines: [...draft.lines, { key, categoryId: '', amount: '', memo: '' }],
		nextLineKey: key + 1
	};
}

export function removeLine(draft: Draft, key: number): Draft {
	if (draft.lines.length <= 2) return draft;
	return { ...draft, lines: draft.lines.filter((line) => line.key !== key) };
}

export function fillRemainder(draft: Draft, key: number): Draft {
	const left = remainderOf(draft);
	const line = draft.lines.find((candidate) => candidate.key === key);
	if (left === undefined || left <= 0 || line?.amount.trim() !== '') {
		return draft;
	}
	return {
		...draft,
		lines: draft.lines.map((candidate) =>
			candidate.key === key ? { ...candidate, amount: shownSize(left) } : candidate
		)
	};
}

export function chooseLink(draft: Draft, link: string): Draft {
	return { ...draft, link };
}

function signedAmount(draft: Draft) {
	const cents = parseCents(draft.amount);
	if (cents === undefined) return undefined;
	return draft.direction === 'outflow' ? -Math.abs(cents) : Math.abs(cents);
}

function newTransferSideOfImport(draft: Draft, world: World) {
	const { saved } = world;
	if (saved === undefined || saved.bankRows.length === 0) return undefined;
	const selection = selectionOf(draft, world);
	if (selection.kind !== 'transfer' || saved.transfer?.accountId === selection.accountId) {
		return undefined;
	}
	return transferAccountsOf(draft, world.accounts).find(
		(account) => account._id === selection.accountId
	);
}

export function linkQuery(
	draft: Draft,
	world: World
): { transferAccountId: Id<'accounts'>; date: string; amount: number } | undefined {
	const other = newTransferSideOfImport(draft, world);
	const amount = signedAmount(draft);
	if (other === undefined || amount === undefined || !isIsoDate(draft.date)) return undefined;
	return { transferAccountId: other._id, date: draft.date, amount };
}

function remainderOf(draft: Draft) {
	const total = parseCents(draft.amount);
	if (total === undefined) return undefined;
	let left = Math.abs(total);
	for (const line of draft.lines) {
		const notFilledInYet = line.amount.trim() === '';
		const cents = notFilledInYet ? 0 : parseCents(line.amount);
		if (cents === undefined) return undefined;
		left -= cents;
	}
	return left;
}

function splitsOf(draft: Draft, world: World) {
	const splits = [];
	for (const line of draft.lines) {
		const categoryId = categoryIn(world, line.categoryId);
		const cents = parseCents(line.amount);
		if (categoryId === undefined) return 'Pick a Category for each line.';
		if (cents === undefined) return "Enter each line's amount, such as 12.50.";
		const amount = draft.direction === 'outflow' ? -cents : cents;
		splits.push({ categoryId, amount, memo: line.memo });
	}
	if (splits.length < 2) return 'A split needs two or more lines.';
	const remainder = remainderOf(draft) ?? 0;
	if (remainder > 0) return `${formatCents(remainder)} is still left to split.`;
	if (remainder < 0) return `The lines are ${formatCents(-remainder)} over the amount.`;
	return splits;
}

function resolvedChoice(selection: Selection): Choice | undefined {
	switch (selection.kind) {
		case 'recalling':
		case 'recallFailed':
			return undefined;
		default:
			return selection;
	}
}

function payloadOf(
	draft: Draft,
	world: World,
	choice: Choice,
	transferAccounts: readonly AccountChoice[],
	linked: { readonly _id: Id<'transactions'> } | undefined
): Payload {
	const account = world.accounts.find((a) => a._id === draft.accountId);
	const amount = signedAmount(draft);
	if (!account) return { kind: 'invalid', message: 'Pick an Account.' };
	if (amount === undefined) {
		return { kind: 'invalid', message: 'Enter the amount, such as 12.50.' };
	}
	const shared = { accountId: account._id, date: draft.date, amount, memo: draft.memo };
	switch (choice.kind) {
		case 'uncategorized':
			return { kind: 'ready', fields: { ...shared, payee: draft.payee } };
		case 'category':
			return {
				kind: 'ready',
				fields: { ...shared, payee: draft.payee, categoryId: choice.categoryId }
			};
		case 'split': {
			const splits = splitsOf(draft, world);
			if (typeof splits === 'string') return { kind: 'invalid', message: splits };
			return { kind: 'ready', fields: { ...shared, payee: draft.payee, splits } };
		}
		case 'transfer': {
			const other = transferAccounts.find((a) => a._id === choice.accountId);
			if (!other) return { kind: 'invalid', message: 'Pick another Account to transfer with.' };
			const noPayeeOrCategory = { payee: '' };
			return {
				kind: 'ready',
				fields: {
					...shared,
					...noPayeeOrCategory,
					transferAccountId: other._id,
					...(linked === undefined ? {} : { transferTransactionId: linked._id })
				}
			};
		}
	}
}

export function view<Candidate extends { readonly _id: Id<'transactions'> }>(
	draft: Draft,
	world: World,
	linkCandidates: Lookup<readonly Candidate[]>
): View<Candidate> {
	const selection = selectionOf(draft, world);
	const transferAccounts = transferAccountsOf(draft, world.accounts);
	const candidates =
		newTransferSideOfImport(draft, world) !== undefined && linkCandidates.kind === 'loaded'
			? linkCandidates.data
			: [];
	const link =
		draft.link === NEW_SIDE || candidates.some((candidate) => candidate._id === draft.link)
			? (draft.link ?? NEW_SIDE)
			: (candidates[0]?._id ?? NEW_SIDE);
	const choice = resolvedChoice(selection);
	const linkLoading = linkQuery(draft, world) !== undefined && linkCandidates.kind === 'loading';
	const payload: Payload =
		choice === undefined || linkLoading
			? { kind: 'waiting' }
			: payloadOf(
					draft,
					world,
					choice,
					transferAccounts,
					candidates.find((candidate) => candidate._id === link)
				);
	return {
		selection,
		transferAccounts,
		cardPayment: isCardPayment(draft, selection, world.accounts),
		remainder: remainderOf(draft),
		blankLine: draft.lines.some((line) => line.amount.trim() === ''),
		candidates,
		link,
		payload
	};
}

export function savedCategoryOf(
	saved: Saved | undefined,
	categoryId: string
): { id: Id<'categories'>; name: string | undefined } | undefined {
	const savedLine = saved?.splits?.find((line) => line.categoryId === categoryId);
	if (savedLine) return { id: savedLine.categoryId, name: savedLine.categoryName };
	if (saved?.categoryId === categoryId) {
		return { id: saved.categoryId, name: saved.categoryName ?? undefined };
	}
	return undefined;
}

export function unlisted(catalog: Catalog | undefined, id: string | null | undefined): boolean {
	return (
		id !== null &&
		id !== undefined &&
		catalog !== undefined &&
		id !== catalog.readyToAssignId &&
		!catalog.groups.some((group) => group.categories.some((c) => c._id === id))
	);
}
