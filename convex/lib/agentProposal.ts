import { Result } from 'effect';
import { v, type Infer } from 'convex/values';

import type { Refusal } from './agentQuery';

export const proposalOutcome = v.union(
	v.literal('applied'),
	v.literal('changed'),
	v.literal('transfer'),
	v.literal('startingBalance'),
	v.literal('split'),
	v.literal('notAllowed')
);

export type ProposalOutcome = Infer<typeof proposalOutcome>;

export const transferOutcome = v.union(
	v.literal('applied'),
	v.literal('changed'),
	v.literal('transfer'),
	v.literal('startingBalance'),
	v.literal('split'),
	v.literal('notEligible')
);

export type TransferOutcome = Infer<typeof transferOutcome>;

export const PROPOSAL_CHANGE_LIMIT = 100;
export const NEW_NAME_LIMIT = 20;
export const PROPOSAL_ID = /^[\w.:-]{1,100}$/;

export type ChangeTarget = { categoryId: string } | { newCategory: string };
export type GroupChoice = { groupId: string } | { newGroup: string };

export interface ProposedChange {
	transactionId: string;
	line?: number | undefined;
	fromCategoryId: string | null;
	to: ChangeTarget;
}

export interface ProposedTransferSide {
	transactionId: string;
	fromCategoryId: string | null;
}

export interface ProposedTransfer {
	first: ProposedTransferSide;
	second: ProposedTransferSide;
}

export interface NewCategory {
	name: string;
	group: GroupChoice;
}

export interface Proposal {
	id: string;
	newGroups: string[];
	newCategories: NewCategory[];
	changes: ProposedChange[];
	transfers: ProposedTransfer[];
}

type Json = Record<string, unknown>;
type Parsed<T> = Result.Result<T, string>;

const ok = Result.succeed;
const problem = Result.fail;

function objectAt(value: unknown, where: string): Parsed<Json> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return problem(`${where} must be a JSON object.`);
	}
	return ok(value as Json);
}

function onlyFields(object: Json, allowed: readonly string[], where: string): Parsed<Json> {
	const unknown = Object.keys(object).find((field) => !allowed.includes(field));
	if (unknown === undefined) return ok(object);
	return problem(`${where} has unknown field ${unknown}. Accepted fields: ${allowed.join(', ')}.`);
}

function fieldsAt(value: unknown, allowed: readonly string[], where: string): Parsed<Json> {
	return Result.flatMap(objectAt(value, where), (object) => onlyFields(object, allowed, where));
}

function textAt(value: unknown, where: string): Parsed<string> {
	if (typeof value !== 'string' || value.trim() === '') {
		return problem(`${where} must be non-empty text.`);
	}
	return ok(value.trim());
}

function listAt<T>(
	value: unknown,
	where: string,
	limit: number,
	parse: (item: unknown, index: number) => Parsed<T>
): Parsed<T[]> {
	if (value === undefined) return ok([]);
	if (!Array.isArray(value)) return problem(`${where} must be a list.`);
	if (value.length > limit) return problem(`${where} takes at most ${String(limit)} items.`);
	return Result.all(value.map((item: unknown, index) => parse(item, index)));
}

function oneOf<A extends string, B extends string>(
	object: Json,
	a: A,
	b: B,
	where: string
): Parsed<{ field: A | B; text: string }> {
	const hasA = object[a] !== undefined;
	if (hasA === (object[b] !== undefined)) {
		return problem(`${where} needs exactly one of ${a} or ${b}.`);
	}
	const field = hasA ? a : b;
	return Result.map(textAt(object[field], `${where}.${field}`), (text) => ({ field, text }));
}

function lineAt(value: unknown, where: string): Parsed<number | undefined> {
	if (value === undefined) return ok(undefined);
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
		return problem(`${where}.line must be a split line's position, counting from 0.`);
	}
	return ok(value);
}

function fromAt(value: unknown, where: string): Parsed<string | null> {
	if (value === undefined) {
		return problem(`${where}.fromCategoryId must be the Category you read, or null.`);
	}
	return value === null ? ok(null) : textAt(value, `${where}.fromCategoryId`);
}

const CHANGE_FIELDS = ['transactionId', 'line', 'fromCategoryId', 'toCategoryId', 'toNewCategory'];

function parseChange(value: unknown, index: number): Parsed<ProposedChange> {
	const where = `changes[${String(index)}]`;
	return Result.gen(function* () {
		const change = yield* fieldsAt(value, CHANGE_FIELDS, where);
		const transactionId = yield* textAt(change.transactionId, `${where}.transactionId`);
		const line = yield* lineAt(change.line, where);
		const fromCategoryId = yield* fromAt(change.fromCategoryId, where);
		const to = yield* oneOf(change, 'toCategoryId', 'toNewCategory', where);
		if (to.field === 'toCategoryId' && to.text === fromCategoryId) {
			return yield* problem(`${where} moves the Transaction to the Category it already has.`);
		}
		const target: ChangeTarget =
			to.field === 'toCategoryId' ? { categoryId: to.text } : { newCategory: to.text };
		return { transactionId, line, fromCategoryId, to: target };
	});
}

const TRANSFER_SIDE_FIELDS = ['transactionId', 'fromCategoryId'];

function parseTransferSide(value: unknown, where: string): Parsed<ProposedTransferSide> {
	return Result.gen(function* () {
		const side = yield* fieldsAt(value, TRANSFER_SIDE_FIELDS, where);
		const transactionId = yield* textAt(side.transactionId, `${where}.transactionId`);
		const fromCategoryId = yield* fromAt(side.fromCategoryId, where);
		return { transactionId, fromCategoryId };
	});
}

function parseTransfer(value: unknown, index: number): Parsed<ProposedTransfer> {
	const where = `transfers[${String(index)}]`;
	return Result.gen(function* () {
		const transfer = yield* fieldsAt(value, ['first', 'second'], where);
		const first = yield* parseTransferSide(transfer.first, `${where}.first`);
		const second = yield* parseTransferSide(transfer.second, `${where}.second`);
		if (first.transactionId === second.transactionId) {
			return yield* problem(`${where} must name two different Transactions.`);
		}
		return { first, second };
	});
}

function parseNewCategory(value: unknown, index: number): Parsed<NewCategory> {
	const where = `newCategories[${String(index)}]`;
	return Result.gen(function* () {
		const category = yield* fieldsAt(value, ['name', 'groupId', 'newGroup'], where);
		const name = yield* textAt(category.name, `${where}.name`);
		const group = yield* oneOf(category, 'groupId', 'newGroup', where);
		const choice: GroupChoice =
			group.field === 'groupId' ? { groupId: group.text } : { newGroup: group.text };
		return { name, group: choice };
	});
}

function duplicateIn(names: readonly string[], what: string): string | undefined {
	const seen = new Set<string>();
	for (const name of names) {
		const key = name.toLowerCase();
		if (seen.has(key)) return `${what} lists ${name} twice.`;
		seen.add(key);
	}
	return undefined;
}

function unlistedIn(
	names: readonly (string | undefined)[],
	listed: readonly string[],
	where: string,
	list: string
): string | undefined {
	const known = new Set(listed.map((name) => name.toLowerCase()));
	const index = names.findIndex((name) => name !== undefined && !known.has(name.toLowerCase()));
	if (index === -1) return undefined;
	return `${where}[${String(index)}] names ${String(names[index])}, which is not in ${list}.`;
}

function transferOverlapIn(
	changes: readonly ProposedChange[],
	transfers: readonly ProposedTransfer[]
): string | undefined {
	const changedIds = new Set(changes.map((change) => change.transactionId));
	const seen = new Set<string>();
	for (const transfer of transfers) {
		for (const side of [transfer.first, transfer.second]) {
			if (changedIds.has(side.transactionId)) {
				return `changes and transfers both list ${side.transactionId}.`;
			}
			if (seen.has(side.transactionId)) return `transfers lists ${side.transactionId} twice.`;
			seen.add(side.transactionId);
		}
	}
	return undefined;
}

function inconsistencyIn({ newGroups, newCategories, changes, transfers }: Omit<Proposal, 'id'>) {
	const categoryNames = newCategories.map((category) => category.name);
	return (
		duplicateIn(newGroups, 'newGroups') ??
		duplicateIn(categoryNames, 'newCategories') ??
		duplicateIn(
			changes.map(({ transactionId, line }) =>
				line === undefined ? transactionId : `${transactionId} line ${String(line)}`
			),
			'changes'
		) ??
		transferOverlapIn(changes, transfers) ??
		unlistedIn(
			newCategories.map(({ group }) => ('newGroup' in group ? group.newGroup : undefined)),
			newGroups,
			'newCategories',
			'newGroups'
		) ??
		unlistedIn(
			changes.map(({ to }) => ('newCategory' in to ? to.newCategory : undefined)),
			categoryNames,
			'changes',
			'newCategories'
		)
	);
}

function proposalOf(value: unknown): Parsed<Proposal> {
	return Result.gen(function* () {
		const body = yield* fieldsAt(
			value,
			['id', 'newGroups', 'newCategories', 'changes', 'transfers'],
			'The proposal'
		);
		const id = yield* textAt(body.id, 'id');
		if (!PROPOSAL_ID.test(id))
			return yield* problem('id takes up to 100 letters, digits, and . _ : -');
		const changes = yield* listAt(body.changes, 'changes', PROPOSAL_CHANGE_LIMIT, parseChange);
		const transfers = yield* listAt(
			body.transfers,
			'transfers',
			PROPOSAL_CHANGE_LIMIT,
			parseTransfer
		);
		if (changes.length + transfers.length === 0) {
			return yield* problem('The proposal must list at least one change or transfer.');
		}
		if (changes.length + transfers.length > PROPOSAL_CHANGE_LIMIT) {
			return yield* problem(
				`The proposal takes at most ${String(PROPOSAL_CHANGE_LIMIT)} changes and transfers.`
			);
		}
		const newGroups = yield* listAt(body.newGroups, 'newGroups', NEW_NAME_LIMIT, (name, index) =>
			textAt(name, `newGroups[${String(index)}]`)
		);
		const newCategories = yield* listAt(
			body.newCategories,
			'newCategories',
			NEW_NAME_LIMIT,
			parseNewCategory
		);
		const proposal = { id, newGroups, newCategories, changes, transfers };
		const inconsistency = inconsistencyIn(proposal);
		if (inconsistency !== undefined) return yield* problem(inconsistency);
		return proposal;
	});
}

function bodyOf(text: string): Parsed<unknown> {
	return Result.mapError(
		Result.try(() => JSON.parse(text) as unknown),
		() => 'The request body must be JSON.'
	);
}

function answered<T>(parsed: Parsed<T>): T | Refusal {
	return Result.isSuccess(parsed) ? parsed.success : { refused: parsed.failure };
}

export function parseProposal(text: string): Proposal | Refusal {
	return answered(Result.flatMap(bodyOf(text), proposalOf));
}

export function parseProposalId(text: string): { id: string } | Refusal {
	return answered(
		Result.gen(function* () {
			const body = yield* fieldsAt(yield* bodyOf(text), ['id'], 'The request');
			return { id: yield* textAt(body.id, 'id') };
		})
	);
}
