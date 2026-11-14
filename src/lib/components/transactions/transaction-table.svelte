<script lang="ts">
	import CheckCheckIcon from '@lucide/svelte/icons/check-check';
	import ListTreeIcon from '@lucide/svelte/icons/list-tree';
	import LockIcon from '@lucide/svelte/icons/lock';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import type { FunctionReturnType } from 'convex/server';
	import type { ClassValue } from 'svelte/elements';
	import { useConvexClient, useMutation, useQuery } from 'convex-svelte';
	import { tick, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import { replaceState } from '$app/navigation';
	import type { ResolvedPathname } from '$app/types';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getAccounts } from '$lib/accounts.svelte';
	import { attempt } from '$lib/attempt';
	import CategoryPicker from '$lib/components/category-picker.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Table from '$lib/components/ui/table';
	import { formatDate } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';
	import { BANK_CHANGE_LIMIT } from '$lib/domain/bankChanges';
	import { BULK_CATEGORIZE_LIMIT } from '$lib/domain/bulkCategorize';
	import { formatUnapprovedCount, UNAPPROVED_COUNT_LIMIT } from '$lib/domain/unapproved';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import { mainRegion, type FocusReturn } from '$lib/focusReturn';
	import { usePaginatedQuery } from '$lib/paginatedQuery.svelte';

	import {
		optionOf,
		rowChoiceFor,
		rowTransferAccounts,
		savedOptionOf
	} from '$lib/transactionEditor';

	import { categoryChoices, labelOf, rememberCopy, transferChoices } from './categoryChoices';
	import ImportDialog from './import-dialog.svelte';
	import { groupByPayee, type PayeeGroup } from './payeeGroups';
	import {
		counted,
		keepsItsCategory,
		keptCategoriesNote,
		SelectionPerScope
	} from './selection.svelte';
	import TransactionDialog from './transaction-dialog.svelte';
	import {
		BANK_CHANGES,
		countedTransactions,
		filtersFromUrl,
		noFilters,
		offeredFilters,
		UNAPPROVED,
		UNCATEGORIZED,
		urlWithFilters
	} from '$lib/transactionFilters';
	import TransactionFilters from './transaction-filters.svelte';

	type Row = FunctionReturnType<typeof api.transactions.list>['page'][number];
	type Categorized = FunctionReturnType<typeof api.transactions.categorizeMany>;
	type Undoable = { scopeKey: string; text: string } & (
		| { kind: 'approved'; transactionIds: Id<'transactions'>[] }
		| { kind: 'categorized'; record: Categorized; label: string }
		| { kind: 'undone' }
	);

	let { accountId }: { accountId?: Id<'accounts'> | undefined } = $props();

	const PAGE_SIZE = 50;

	function bankFlag(row: Row) {
		if (row.bankRows.some((bankRow) => bankRow.state === 'removed')) return 'Bank removed this';
		const changed = row.bankRows.filter((bankRow) => bankRow.state === 'changed');
		if (changed.length === 1 && changed[0])
			return `Bank changed this to ${formatCents(changed[0].amount)}`;
		if (changed.length > 0) return 'Bank changed this';
		return undefined;
	}

	function bankChangeOf(row: Row) {
		const flagged = row.bankRows.filter((bankRow) => bankRow.state !== 'linked');
		return flagged.length === 1 ? flagged[0] : undefined;
	}

	function categoryFilter(value: string) {
		if (value === '') return {};
		if (value === UNCATEGORIZED) return { uncategorized: true as const };
		return { categoryId: value as Id<'categories'> };
	}

	const SEARCH_PAUSE_MS = 300;
	const GROUP_PARAM = 'group';
	const BY_PAYEE = 'payee';
	const groupedIn = (url: URL) => url.searchParams.get(GROUP_PARAM) === BY_PAYEE;
	function urlGrouped(url: URL, grouped: boolean) {
		if (grouped) url.searchParams.set(GROUP_PARAM, BY_PAYEE);
		else url.searchParams.delete(GROUP_PARAM);
		return url;
	}
	let filterValues = $state(filtersFromUrl(page.url));
	let byPayee = $state(groupedIn(page.url));
	let arrivedAt = page.url;
	$effect(() => {
		const url = page.url;
		if (url === arrivedAt) return;
		arrivedAt = url;
		filterValues = filtersFromUrl(url);
		byPayee = groupedIn(url);
	});
	$effect(() => {
		const kept = urlGrouped(urlWithFilters(new URL(location.href), filterValues), byPayee);
		if (kept.href === location.href) return;
		const samePage = `${kept.pathname}${kept.search}${kept.hash}` as ResolvedPathname;
		replaceState(samePage, page.state);
	});

	const accounts = getAccounts();
	const categoryList = useQuery(api.categories.list, {});
	const payeeChoices = useQuery(api.payees.list, {});
	function idsOf<T>(query: { data: T | undefined }, ids: (data: T) => string[]) {
		return query.data === undefined ? undefined : ids(query.data);
	}
	const offered = $derived(
		offeredFilters(filterValues, {
			accountIds: accounts.loaded ? accounts.all.map((account) => account._id) : undefined,
			categoryIds: idsOf(categoryList, (data) => [
				...(data.readyToAssignId === null ? [] : [data.readyToAssignId]),
				...data.groups.flatMap((group) => group.categories.map((category) => category._id))
			]),
			payeeIds: idsOf(payeeChoices, (data) => data.map((payee) => payee._id))
		})
	);
	const applied = $derived(offered ?? noFilters);
	const unchecked = $derived(
		offered === undefined && Boolean(categoryList.error ?? payeeChoices.error)
	);
	$effect(() => {
		if (offered === undefined) return;
		const dropped = (['accountId', 'categoryId', 'payeeId'] as const).some(
			(key) => offered[key] !== filterValues[key]
		);
		if (dropped) filterValues = offered;
	});

	let search = $state('');
	$effect(() => {
		const typed = filterValues.search.trim();
		if (typed === '') {
			search = '';
			return;
		}
		const timer = setTimeout(() => (search = typed), SEARCH_PAUSE_MS);
		return () => {
			clearTimeout(timer);
		};
	});

	const allAccounts = $derived(accountId === undefined);
	const memoFrom = $derived(allAccounts ? '8xl' : '6xl');

	const scopeAccountId = $derived(
		accountId ?? (applied.accountId === '' ? undefined : (applied.accountId as Id<'accounts'>))
	);
	const scope = $derived(scopeAccountId === undefined ? {} : { accountId: scopeAccountId });
	const filters = $derived({
		...(search === '' ? {} : { search }),
		...categoryFilter(applied.categoryId),
		...(applied.status === UNAPPROVED ? { approval: 'unapproved' as const } : {}),
		...(applied.status === BANK_CHANGES ? { bankChanges: true as const } : {}),
		...(applied.payeeId === '' ? {} : { payeeId: applied.payeeId as Id<'payees'> }),
		...(applied.from === '' ? {} : { from: applied.from }),
		...(applied.to === '' ? {} : { to: applied.to })
	});
	const filtering = $derived(Object.keys(filters).length > 0);

	const first = usePaginatedQuery(
		api.transactions.list,
		() => {
			if (offered === undefined) return 'skip';
			return filtering ? { ...scope, ...filters } : { ...scope, approval: 'unapproved' as const };
		},
		{ initialNumItems: PAGE_SIZE }
	);
	const hasSecond = $derived(
		!filtering || (filters.categoryId !== undefined && filters.bankChanges === undefined)
	);
	const second = usePaginatedQuery(
		api.transactions.list,
		() => {
			if (first.status !== 'Exhausted' || !hasSecond) return 'skip';
			return filtering
				? { ...scope, ...filters, splitLines: true }
				: { ...scope, approval: 'approved' as const };
		},
		{ initialNumItems: PAGE_SIZE }
	);
	const unapprovedCount = useQuery(api.transactions.unapprovedCount, () =>
		offered === undefined ? 'skip' : scope
	);
	const bankChangeCount = useQuery(api.transactions.bankChangeCount, () =>
		offered !== undefined && filters.bankChanges ? scope : 'skip'
	);
	const bankChangesCut = $derived(bankChangeCount.data?.complete === false);
	const setCleared = useMutation(api.transactions.setCleared);
	const approve = useMutation(api.transactions.approve);
	const approveAll = useMutation(api.transactions.approveAll);
	const approveMany = useMutation(api.transactions.approveMany);
	const unapprove = useMutation(api.transactions.unapprove);
	const categorize = useMutation(api.transactions.categorize);
	const categorizeMany = useMutation(api.transactions.categorizeMany);
	const undoCategorizeMany = useMutation(api.transactions.undoCategorizeMany);
	const convex = useConvexClient();
	const picked = new SvelteMap<Id<'transactions'>, string>();
	const latestPick = new SvelteMap<Id<'transactions'>, number>();
	let preset = $state<string | undefined>();
	const resolveBankChange = useMutation(api.imports.resolveBankChange);
	let resolving = $state(false);
	const removal = new DialogSession<{ row: Row; importId: Id<'imports'>; payee: string }>();
	const confirmRemoval = $derived(removal.current);
	let afterRemoval: HTMLElement | undefined;
	let undoable = $state<Undoable | null>(null);
	const scopeKey = $derived(JSON.stringify([scope, filters]));
	const undo = $derived(undoable?.scopeKey === scopeKey ? undoable : null);
	function touchedBy(entry: Undoable) {
		if (entry.kind === 'approved') return entry.transactionIds;
		if (entry.kind === 'categorized') return entry.record.changes.map((c) => c.transactionId);
		return [];
	}
	function retireUndoOf(transactionId: Id<'transactions'> | undefined) {
		if (undoable === null || transactionId === undefined) return;
		if (touchedBy(undoable).includes(transactionId)) undoable = null;
	}
	const selection = new SelectionPerScope(
		() => scopeKey,
		() => (loading || first.error || second.error ? undefined : rows.map((row) => row._id))
	);

	const approveAllLabel = $derived.by(() => {
		if (selecting) {
			const count = selectedUnapproved.length;
			return count === 0 ? 'Approve selected' : `Approve ${String(count)} selected`;
		}
		if (shownUnapproved !== null) {
			const shown = shownUnapproved.length;
			return shown === 0 ? 'Approve shown' : `Approve ${String(shown)} shown`;
		}
		const count = unapprovedCount.data ?? 0;
		if (count === 0) return 'Approve all';
		if (count > UNAPPROVED_COUNT_LIMIT)
			return `Approve ${formatUnapprovedCount(UNAPPROVED_COUNT_LIMIT)}`;
		if (count === 1) return 'Approve 1';
		return `Approve all ${formatUnapprovedCount(count)}`;
	});

	const problem = $derived.by(() => {
		if (rowError !== '') return rowError;
		if (unchecked)
			return "Budge couldn't load the Categories or Payees to check your filters. Try reloading the page.";
		if (first.error ?? second.error)
			return "Budge couldn't load Transactions. Try reloading the page.";
		return '';
	});

	const secondShown = $derived(first.status === 'Exhausted' && hasSecond);

	const rows = $derived(
		[...first.results, ...(secondShown ? second.results : [])].filter(
			(row, index, all) => all.findIndex((other) => other._id === row._id) === index
		)
	);
	const shownUnapproved = $derived(
		filtering
			? rows
					.filter((row) => !row.approved)
					.slice(0, UNAPPROVED_COUNT_LIMIT)
					.map((row) => row._id)
			: null
	);
	const selected = $derived(selection.of(rows));
	const selecting = $derived(selected.length > 0);
	const selectedUnapproved = $derived(
		selected
			.filter((row) => !row.approved)
			.slice(0, UNAPPROVED_COUNT_LIMIT)
			.map((row) => row._id)
	);
	const approving = $derived(selecting ? selectedUnapproved : shownUnapproved);
	const categorizable = $derived(selected.filter((row) => !keepsItsCategory(row)));
	const keptNote = $derived(keptCategoriesNote(selected));
	const tooManyToCategorize = $derived(categorizable.length > BULK_CATEGORIZE_LIMIT);
	const bulkChoices = $derived([
		{ value: optionOf({ kind: 'uncategorized' }), label: 'Uncategorized' },
		...categoryChoices(categoryList.data)
	]);
	const NOTHING_PICKED = 'nothing-picked';
	let bulkPick = $state(NOTHING_PICKED);
	let categorizingMany = $state(false);
	let selectionBarHeight = $state(0);

	$effect(() => {
		if (!selecting) return;
		const root = document.documentElement;
		root.style.setProperty('--selection-bar-height', `${String(selectionBarHeight)}px`);
		return () => {
			root.style.removeProperty('--selection-bar-height');
		};
	});
	let undoButton: HTMLButtonElement | null = $state(null);
	const linkButton =
		'relative -my-0.5 min-h-6 shrink-0 rounded-sm px-1 font-medium text-foreground underline underline-offset-4 after:absolute after:-inset-x-2 after:-inset-y-2.5 hover:no-underline';
	const sections = $derived.by(() => {
		const waiting = rows.filter((row) => !row.approved);
		const split =
			filtering || waiting.length === 0
				? [{ label: '', rows }]
				: [
						{ label: 'Unapproved', rows: waiting },
						{ label: 'Approved', rows: rows.filter((row) => row.approved) }
					];
		return split.map((section) => ({
			...section,
			payees: byPayee ? groupByPayee(section.rows) : []
		}));
	});
	const listed = $derived(
		sections.flatMap((section) =>
			byPayee ? section.payees.flatMap((group) => group.rows) : section.rows
		)
	);
	const loading = $derived(
		offered === undefined || first.isLoading || (secondShown && second.isLoading)
	);
	const more = $derived(secondShown ? second : first);
	const canShowMore = $derived(more.status === 'CanLoadMore' || more.status === 'LoadingMore');
	const result = $derived.by(() => {
		if (unchecked) return 'Transactions show once your filters are checked.';
		if (rows.length === 0 && loading) return 'Loading Transactions…';
		if (bankChangesCut) {
			const newest = `the newest ${String(BANK_CHANGE_LIMIT)} bank changes`;
			const rest = 'Resolve them to see the rest.';
			if (rows.length === 0) return `None of ${newest} is here. ${rest}`;
			return `${countedTransactions(rows.length, filterValues)}, from ${newest}. ${rest}`;
		}
		if (rows.length === 0 && filters.bankChanges) return 'No bank changes wait on you.';
		if (rows.length === 0) return filtering ? 'No Transactions match.' : 'No Transactions yet.';
		const counted = countedTransactions(rows.length, filterValues);
		return canShowMore ? `${counted} shown, more below` : counted;
	});
	let announcement = $state('');
	function announce(message: string) {
		announcement = announcement === message ? `${message}\u00a0` : message;
	}
	const unselectedNote = $derived.by(() => {
		const count = selection.leftTheList?.count;
		if (count === undefined) return '';
		return `${counted(count, 'selected Transaction')} left the list and ${count === 1 ? 'was' : 'were'} unselected.`;
	});
	$effect(() => {
		const note = unselectedNote;
		if (note !== '')
			untrack(() => {
				announce(note);
			});
	});
	let addButton: HTMLButtonElement | HTMLAnchorElement | null = $state(null);
	let approveAllButton: HTMLButtonElement | HTMLAnchorElement | null = $state(null);
	function shownOf(selector: string) {
		return [...document.querySelectorAll<HTMLElement>(selector)].find((element) =>
			element.checkVisibility()
		);
	}
	const editButtonOf = (row: Row | undefined) =>
		row === undefined ? undefined : shownOf(`[data-edit="${row._id}"]`);
	function firstShown(
		ids: Iterable<Id<'transactions'>>,
		controlOf: (row: Row) => HTMLElement | undefined
	) {
		const candidates = new Set(ids);
		for (const row of listed) {
			const control = candidates.has(row._id) ? controlOf(row) : undefined;
			if (control !== undefined) return control;
		}
		return undefined;
	}
	let dialogOpen = $state(false);
	let importOpen = $state(false);
	let editingSnapshot: Row | undefined = $state();
	let editingAt = -1;
	let deletedId: Id<'transactions'> | null = null;
	const editing = $derived(
		editingSnapshot === undefined
			? undefined
			: (rows.find((row) => row._id === editingSnapshot?._id) ?? editingSnapshot)
	);
	let rowError = $state('');
	let approvingAll = $state(false);
	const approveAllBlocked = $derived(
		approvingAll || (approving?.length ?? unapprovedCount.data ?? 0) === 0
	);

	function add() {
		editingSnapshot = undefined;
		preset = undefined;
		dialogOpen = true;
	}

	function editedRow() {
		if (editingSnapshot === undefined) return addButton;
		if (deletedId === editingSnapshot._id) return null;
		return editButtonOf(editingSnapshot);
	}

	function neighborOfEdited() {
		const remaining = listed.filter((row) => row._id !== deletedId);
		for (const candidate of [remaining[editingAt], remaining[editingAt - 1]]) {
			const button = editButtonOf(candidate);
			if (button !== undefined) return button;
		}
		return addButton;
	}

	const editingFocus: FocusReturn = {
		opener: editedRow,
		continuation: neighborOfEdited,
		fallback: mainRegion
	};
	const removalFocus: FocusReturn = {
		opener: (opened) => (afterRemoval === undefined ? opened : null),
		continuation: () => afterRemoval,
		fallback: mainRegion
	};

	function categoryOf(row: Row) {
		if (row.transfer) return `${row.amount < 0 ? 'To' : 'From'} ${row.transfer.accountName}`;
		if (row.splits) return 'Split';
		return row.categoryName ?? 'Uncategorized';
	}

	function openFromRow(event: MouseEvent, row: Row) {
		if (!(event.target instanceof Element)) return;
		if (event.target.closest('button, a, input, label, [role="checkbox"], [data-pick]')) return;
		if ((getSelection()?.toString() ?? '') !== '') return;
		edit(row);
	}

	function edit(row: Row, option?: string) {
		preset = option;
		deletedId = null;
		editingSnapshot = row;
		editingAt = listed.findIndex((other) => other._id === row._id);
		dialogOpen = true;
	}

	function choicesFor(row: Row) {
		const saved =
			row.categoryId === null ? undefined : { id: row.categoryId, name: row.categoryName ?? '' };
		return [
			{ value: optionOf({ kind: 'uncategorized' }), label: 'Uncategorized' },
			...categoryChoices(categoryList.data, saved),
			...(row.startingBalance ? [] : transferChoices(rowTransferAccounts(row, accounts.all)))
		];
	}

	const categoryPickerOf = (row: Row | undefined) =>
		row === undefined ? undefined : shownOf(`[data-category="${row._id}"]`);

	async function linksAnImport(row: Row, option: string) {
		const choice = rowChoiceFor(option);
		if (choice?.kind !== 'transfer' || row.bankRows.length === 0) return false;
		if (row.transfer?.accountId === choice.accountId) return false;
		const found = await attempt(() =>
			convex.query(api.transactions.transferCandidates, {
				transferAccountId: choice.accountId,
				date: row.date,
				amount: row.amount
			})
		);
		return !found.ok || found.value.length > 0;
	}

	function rememberingFor(row: Row) {
		if (row.payeeName === null || row.startingBalance) return undefined;
		const choices = choicesFor(row);
		return {
			...rememberCopy(choices, row.payeeName, row.rememberedCategoryId),
			accepts: (option: string) => rowChoiceFor(option)?.kind === 'category'
		};
	}

	function changeOf(row: Row, option: string, remember: boolean) {
		const found = rowChoiceFor(option);
		if (found === undefined) return undefined;
		const remembers = remember && found.kind === 'category';
		const unchanged = option === (picked.get(row._id) ?? savedOptionOf(row));
		if (unchanged && (!remembers || option === row.rememberedCategoryId)) return undefined;
		return { choice: remembers ? { ...found, remember } : found, remembers };
	}

	async function pickCategory(row: Row, option: string, payee: string, remember: boolean) {
		const change = changeOf(row, option, remember);
		if (change === undefined) return;
		const { choice, remembers } = change;
		rowError = '';
		retireUndoOf(row._id);
		const pick = (latestPick.get(row._id) ?? 0) + 1;
		latestPick.set(row._id, pick);
		picked.set(row._id, option);
		const at = listed.findIndex((other) => other._id === row._id);
		const handOff = await linksAnImport(row, option);
		if (latestPick.get(row._id) !== pick) return;
		if (handOff) {
			picked.delete(row._id);
			edit(row, option);
			return;
		}
		const saved = await attempt(() => categorize({ transactionId: row._id, choice }));
		if (latestPick.get(row._id) !== pick) return;
		picked.delete(row._id);
		if (!saved.ok) {
			rowError = "Budge couldn't change the Category. Try again.";
			return;
		}
		const label = labelOf(choicesFor(row), option) ?? 'Category';
		announce(
			remembers ? `${label} saved and remembered for ${payee}` : `${label} saved for ${payee}`
		);
		await tick();
		if (document.activeElement === document.body) focusAfterCategorize(row, at);
	}

	function focusAfterCategorize(row: Row, at: number) {
		const target = [row, listed[at], listed[at - 1]]
			.map((candidate) => categoryPickerOf(candidate) ?? editButtonOf(candidate))
			.find((element) => element !== undefined);
		(target ?? addButton)?.focus();
	}

	async function toggleCleared(row: Row, cleared: boolean) {
		rowError = '';
		const changed = await attempt(() => setCleared({ transactionId: row._id, cleared }));
		if (!changed.ok) rowError = "Budge couldn't change Cleared. Try again.";
	}

	async function approveRow(row: Row, payee: string) {
		rowError = '';
		undoable = null;
		const approvedIn = scopeKey;
		const at = listed.findIndex((other) => other._id === row._id);
		const waiting = [...listed.slice(at + 1), ...listed.slice(0, at).reverse()].filter(
			(other) => !other.approved
		);
		const approved = await attempt(() => approve({ transactionId: row._id }));
		if (!approved.ok) {
			rowError = "Budge couldn't approve the Transaction. Try again.";
			return;
		}
		undoable = {
			kind: 'approved',
			scopeKey: approvedIn,
			transactionIds: [row._id],
			text: `Approved ${payee}.`
		};
		announce(`Approved ${payee}`);
		await tick();
		const next = waiting.find((other) =>
			rows.some((shown) => shown._id === other._id && !shown.approved)
		);
		const target =
			(next && (shownOf(`[data-approve="${next._id}"]`) ?? editButtonOf(next))) ?? approveAllButton;
		target?.focus();
	}

	async function resolveRow(
		row: Row,
		importId: Id<'imports'>,
		keep: 'bank' | 'mine',
		payee: string
	) {
		if (resolving) return undefined;
		rowError = '';
		retireUndoOf(row._id);
		resolving = true;
		const at = listed.findIndex((other) => other._id === row._id);
		const resolved = await attempt(() => resolveBankChange({ importId, keep }));
		resolving = false;
		if (!resolved.ok) {
			rowError = resolved.error?.message ?? "Budge couldn't resolve the bank's change. Try again.";
			return undefined;
		}
		announce(keep === 'bank' ? `Took the bank's version of ${payee}` : `Kept your ${payee}`);
		await tick();
		return focusAfterResolve(row, at);
	}

	function focusAfterResolve(row: Row, at: number) {
		const candidates = [listed[at], listed[at - 1]].filter((candidate) => candidate !== undefined);
		const same = candidates.find((candidate) => candidate._id === row._id);
		if (same) return editButtonOf(same);
		for (const candidate of candidates) {
			const target = shownOf(`[data-bank-action="${candidate._id}"]`) ?? editButtonOf(candidate);
			if (target !== undefined) return target;
		}
		return addButton ?? undefined;
	}

	let loadedBefore: Set<Id<'transactions'>> | null = null;
	function showMore() {
		if (more.status !== 'CanLoadMore') return;
		loadedBefore = new Set(rows.map((row) => row._id));
		more.loadMore(PAGE_SIZE);
	}
	$effect(() => {
		const shown = rows;
		const before = loadedBefore;
		if (before === null || more.status === 'LoadingMore') return;
		const loaded = shown.filter((row) => !before.has(row._id)).map((row) => row._id);
		if (loaded.length === 0) return;
		loadedBefore = null;
		void tick().then(() => firstShown(loaded, editButtonOf)?.focus());
	});

	async function approveEvery() {
		if (approveAllBlocked) return;
		rowError = '';
		approvingAll = true;
		const approvedIn = scopeKey;
		const from = selection.mark();
		const transactionIds = approving;
		const approved = await attempt(() =>
			transactionIds === null ? approveAll(scope) : approveMany({ transactionIds })
		);
		approvingAll = false;
		if (!selection.owns(from)) return;
		if (!approved.ok) {
			rowError = "Budge couldn't approve the Transactions. Try again.";
			return;
		}
		selection.clear();
		undoable = {
			kind: 'approved',
			scopeKey: approvedIn,
			transactionIds: approved.value,
			text: approvedText(approved.value.length)
		};
	}

	function approvedText(count: number) {
		return `Approved ${String(count)} ${count === 1 ? 'Transaction' : 'Transactions'}.`;
	}

	async function categorizeSelected(option: string, approveToo: boolean) {
		const choice = rowChoiceFor(option);
		const changing = categorizable;
		if (choice === undefined || choice.kind === 'transfer' || categorizingMany) return;
		if (changing.length === 0 || tooManyToCategorize) return;
		rowError = '';
		undoable = null;
		categorizingMany = true;
		const changedIn = scopeKey;
		const from = selection.mark();
		const label = labelOf(bulkChoices, option) ?? 'their Category';
		const saved = await attempt(() =>
			categorizeMany({
				transactionIds: changing.map((row) => row._id),
				categoryId: choice.kind === 'category' ? choice.categoryId : null,
				approve: approveToo
			})
		);
		categorizingMany = false;
		bulkPick = NOTHING_PICKED;
		if (!selection.owns(from)) return;
		if (!saved.ok) {
			rowError = saved.error?.message ?? "Budge couldn't change the Categories. Try again.";
			return;
		}
		selection.clear();
		const text = `${counted(changing.length, 'Transaction')} now ${label}${approveToo ? ' and approved' : ''}.`;
		if (saved.value.changes.length === 0) {
			announce(text);
			return;
		}
		undoable = { kind: 'categorized', scopeKey: changedIn, record: saved.value, label, text };
		await tick();
		undoButton?.focus();
	}

	function clearSelection() {
		selection.clear();
		announce('Selection cleared');
		approveAllButton?.focus();
	}

	function keptText(label: string, kept: number, restored: number) {
		const who = restored === 0 ? counted(kept, 'Transaction') : String(kept);
		const why =
			kept === 1 ? 'its earlier Category was deleted' : 'their earlier Categories were deleted';
		return `${who} kept ${label} because ${why}.`;
	}

	async function undoLast() {
		if (undo === null || undo.kind === 'undone') return;
		const entry = undo;
		undoable = null;
		rowError = '';
		const restored = await attempt(async () => {
			if (entry.kind === 'approved') {
				const count = await unapprove({ transactionIds: entry.transactionIds });
				return `${String(count)} back to Unapproved.`;
			}
			const { restored: back, kept } = await undoCategorizeMany(entry.record);
			const putBack = back > 0 || kept === 0 ? [`${counted(back, 'Transaction')} put back.`] : [];
			return [...putBack, ...(kept > 0 ? [keptText(entry.label, kept, back)] : [])].join(' ');
		});
		if (!restored.ok) {
			undoable ??= entry;
			rowError =
				entry.kind === 'approved'
					? "Budge couldn't undo the approvals. Try again."
					: "Budge couldn't put the Categories back. Try again.";
			return;
		}
		const text = restored.value;
		undoable = { kind: 'undone', scopeKey: entry.scopeKey, text };
		await tick();
		const control = entry.kind === 'approved' ? 'data-approve' : 'data-category';
		const back = firstShown(touchedBy(entry), (row) => shownOf(`[${control}="${row._id}"]`));
		(back ?? approveAllButton)?.focus();
	}
</script>

{#snippet transactionRow(row: (typeof rows)[number])}
	{@const payee = row.payeeName ?? (row.transfer ? 'Transfer' : 'No Payee')}
	{@const flag = bankFlag(row)}
	{@const bankChange = bankChangeOf(row)}
	{@const categoryClass =
		row.categoryName === null && !row.transfer && !row.splits ? 'text-warning' : undefined}
	<Table.Row
		weight={row.approved ? 'normal' : 'strong'}
		opens
		data-state={selection.has(row._id) ? 'selected' : undefined}
		onclick={(event: MouseEvent) => {
			openFromRow(event, row);
		}}
	>
		<Table.Cell width="select" data-pick>
			<Checkbox
				bind:checked={
					() => selection.has(row._id),
					(checked: boolean) => {
						selection.set([row._id], checked);
					}
				}
				aria-label="Select {payee}, {formatDate(row.date)}"
			/>
		</Table.Cell>
		{#if !byPayee}
			<Table.Cell numeric showFrom="2xl">
				<time datetime={row.date} class="block truncate">{formatDate(row.date)}</time>
			</Table.Cell>
		{/if}
		{#if allAccounts}
			<Table.Cell showFrom="5xl">
				<span class="block truncate">{row.accountName}</span>
			</Table.Cell>
		{/if}
		<Table.Cell>
			<button
				data-edit={row._id}
				aria-label="{payee}, {row.approved ? '' : 'Unapproved, '}edit Transaction on {formatDate(
					row.date
				)}"
				class="relative block max-w-full rounded-sm text-left hover:underline pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-2.5"
				onclick={() => {
					edit(row);
				}}
			>
				{#if byPayee}
					<time datetime={row.date} class="tabular-nums">{formatDate(row.date)}</time>
				{:else}
					<span
						class={[
							'break-words whitespace-normal @4xl:line-clamp-1',
							row.payeeName === null && !row.transfer && 'text-muted-foreground'
						]}
					>
						{payee}
					</span>
				{/if}
			</button>
			{#if flag}
				<span class="block text-xs font-normal break-words text-warning">{flag}</span>
			{/if}
			<span class="flex min-w-0 flex-wrap gap-x-2 text-xs font-normal text-muted-foreground">
				{#if !byPayee}
					<time datetime={row.date} class="shrink-0 tabular-nums @2xl:hidden">
						{formatDate(row.date, 'short')}
					</time>
				{/if}
				{@render rowCategory(row, payee, ['@4xl:hidden', categoryClass])}
			</span>
			{#if allAccounts}
				<span class="block text-xs font-normal break-words text-muted-foreground @5xl:hidden">
					{row.accountName}
				</span>
			{/if}
			{#if row.memo}
				<span
					class={[
						'block truncate text-xs font-normal text-muted-foreground',
						allAccounts ? '@8xl:hidden' : '@6xl:hidden'
					]}
				>
					{row.memo}
				</span>
			{/if}
			{#if bankChange}
				<span class="mt-2 mb-1 flex flex-wrap gap-2 font-normal">
					{#if bankChange.state === 'changed'}
						<Button
							data-bank-action={row._id}
							size="sm"
							variant="outline"
							aria-disabled={resolving}
							aria-label="Use the bank's {formatCents(bankChange.amount)}: {payee}, {formatDate(
								row.date
							)}"
							onclick={async () => (await resolveRow(row, bankChange._id, 'bank', payee))?.focus()}
						>
							Use the bank's
						</Button>
					{:else}
						<Button
							data-bank-action={row._id}
							size="sm"
							variant="outline"
							aria-disabled={resolving}
							aria-label="Delete it: {payee}, {formatDate(row.date)}"
							onclick={() => {
								afterRemoval = undefined;
								removal.open({ row, importId: bankChange._id, payee });
							}}
						>
							Delete it
						</Button>
					{/if}
					<Button
						size="sm"
						variant="outline"
						aria-disabled={resolving}
						aria-label="Keep mine: {payee}, {formatDate(row.date)}"
						onclick={async () => (await resolveRow(row, bankChange._id, 'mine', payee))?.focus()}
					>
						Keep mine
					</Button>
				</span>
			{/if}
		</Table.Cell>
		<Table.Cell showFrom="4xl">
			{@render rowCategory(row, payee, categoryClass)}
		</Table.Cell>
		<Table.Cell showFrom={memoFrom}>
			<span class="block truncate">{row.memo ?? ''}</span>
		</Table.Cell>
		<Table.Cell align="end" numeric>
			{formatCents(row.amount)}
			<span
				class={[
					'mt-2 flex items-center justify-end gap-3 pr-1',
					row.approved ? '@lg:hidden' : '@2xl:hidden'
				]}
			>
				{#if !row.approved}
					<Button
						data-approve={row._id}
						size="sm"
						variant="outline"
						onclick={() => approveRow(row, payee)}
						aria-label="Approve {payee}, {formatDate(row.date)}"
					>
						Approve
					</Button>
				{/if}
				<span class="flex @lg:hidden">{@render cleared(row, payee)}</span>
			</span>
		</Table.Cell>
		<Table.Cell align="center" showFrom="lg">
			<span class="flex justify-center">{@render cleared(row, payee)}</span>
		</Table.Cell>
		<Table.Cell showFrom="2xl">
			{#if !row.approved}
				<Button
					data-approve={row._id}
					size="sm"
					variant="outline"
					onclick={() => approveRow(row, payee)}
					aria-label="Approve {payee}, {formatDate(row.date)}"
				>
					Approve
				</Button>
			{/if}
		</Table.Cell>
	</Table.Row>
{/snippet}

{#snippet sectionHeading(label: string)}
	<Table.Row>
		<Table.Cell></Table.Cell>
		{#if !byPayee}
			<Table.Cell showFrom="2xl"></Table.Cell>
		{/if}
		{#if allAccounts}
			<Table.Cell showFrom="5xl"></Table.Cell>
		{/if}
		<Table.Head scope="rowgroup">{label}</Table.Head>
		<Table.Cell showFrom="4xl"></Table.Cell>
		<Table.Cell showFrom={memoFrom}></Table.Cell>
		<Table.Cell></Table.Cell>
		<Table.Cell showFrom="lg"></Table.Cell>
		<Table.Cell showFrom="2xl"></Table.Cell>
	</Table.Row>
{/snippet}

{#snippet payeeHeading(group: PayeeGroup<Row>, section: string)}
	{@const ids = group.rows.map((row) => row._id)}
	{@const chosen = ids.filter((id) => selection.has(id)).length}
	{@const shown = `${String(ids.length)} ${section === '' ? '' : `${section} `}shown`}
	<Table.Row>
		<Table.Cell width="select">
			<Checkbox
				bind:checked={
					() => chosen === ids.length,
					(checked: boolean) => {
						selection.set(ids, checked);
					}
				}
				indeterminate={chosen > 0 && chosen < ids.length}
				aria-label="Select the {shown} from {group.label}"
			/>
		</Table.Cell>
		{#if allAccounts}
			<Table.Cell showFrom="5xl"></Table.Cell>
		{/if}
		<Table.Head scope="rowgroup" variant="group" colspan={2} hideFrom="lg">
			{@render payeeLabel(group)}
		</Table.Head>
		<Table.Head scope="rowgroup" variant="group" showFrom="lg">
			{@render payeeLabel(group)}
		</Table.Head>
		<Table.Cell showFrom="4xl"></Table.Cell>
		<Table.Cell showFrom={memoFrom}></Table.Cell>
		<Table.Cell showFrom="lg"></Table.Cell>
		<Table.Cell showFrom="lg"></Table.Cell>
		<Table.Cell showFrom="2xl"></Table.Cell>
	</Table.Row>
{/snippet}

{#snippet payeeLabel(group: PayeeGroup<Row>)}
	<span class="font-semibold break-words text-foreground">{group.label}</span>
	<span class="ms-2 inline-block font-normal whitespace-nowrap">{group.rows.length} shown</span>
{/snippet}

{#snippet rowCategory(row: Row, payee: string, className: ClassValue | undefined)}
	{@const category = categoryOf(row)}
	{#if row.splits}
		<span class={['min-w-0 break-words', className]}>{category}</span>
	{:else}
		{@const pending = picked.get(row._id)}
		<span class={['min-w-0', className]}>
			<CategoryPicker
				inline
				data-category={row._id}
				aria-label="{pending === undefined
					? category
					: 'Saving'}, Category of {payee} on {formatDate(row.date)}"
				searchLabel={row.startingBalance ? 'Search Categories' : 'Search Categories and Transfers'}
				value={pending ?? savedOptionOf(row)}
				shown={pending === undefined ? category : undefined}
				choices={choicesFor(row)}
				optIn={rememberingFor(row)}
				onValueChange={(option: string, remember: boolean) =>
					pickCategory(row, option, payee, remember)}
			/>
		</span>
	{/if}
{/snippet}

{#snippet cleared(row: (typeof rows)[number], payee: string)}
	{#if row.reconciled}
		<LockIcon aria-hidden="true" class="size-4 text-muted-foreground" />
		<span class="sr-only">Reconciled</span>
	{:else}
		<Checkbox
			bind:checked={() => row.cleared, (checked: boolean) => void toggleCleared(row, checked)}
			aria-label="Cleared: {payee}, {formatDate(row.date)}"
		/>
	{/if}
{/snippet}

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center gap-2">
		<Button bind:ref={addButton} onclick={add}>
			<PlusIcon aria-hidden="true" />
			Add Transaction
		</Button>
		<Button variant="outline" onclick={() => (importOpen = true)}>
			<UploadIcon aria-hidden="true" />
			<span>Import <span class="max-sm:sr-only">file</span></span>
		</Button>
	</div>
	<TransactionFilters bind:values={filterValues} showAccount={allAccounts} />
	<p
		role="alert"
		class={problem === ''
			? 'sr-only'
			: 'fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md rounded-md border border-destructive bg-popover px-4 py-3 text-sm text-destructive shadow-lg lg:bottom-6'}
	>
		{problem}
	</p>
	<p role="status" class="sr-only">{announcement}</p>
	<div
		data-selection-bar={selecting ? '' : undefined}
		bind:clientHeight={selectionBarHeight}
		class={['@container', selecting && 'sticky top-0 z-20 border-b bg-background py-2']}
	>
		<div
			class="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
		>
			<p
				aria-live="polite"
				class="flex min-h-6 max-w-full min-w-0 items-center gap-2 text-sm text-muted-foreground"
			>
				{#if selecting}
					<span class="truncate font-medium text-foreground">{selected.length} selected</span>
					<button
						type="button"
						aria-label="Clear selection"
						class={linkButton}
						onclick={clearSelection}>Clear</button
					>
				{:else if undo}
					<span class={undo.kind === 'undone' ? 'break-words' : 'truncate'}>{undo.text}</span>
					{#if undo.kind !== 'undone'}
						<button bind:this={undoButton} type="button" class={linkButton} onclick={undoLast}
							>Undo</button
						>
					{/if}
				{:else}
					<span class="truncate">{result}</span>
				{/if}
			</p>
			<div class="flex max-w-full flex-wrap items-center gap-2">
				{#if selecting}
					<div class="w-32 sm:w-40">
						<CategoryPicker
							bind:value={bulkPick}
							aria-label="Category for {counted(categorizable.length, 'selected Transaction')}"
							placeholder="Categorize"
							shown={categorizingMany ? 'Saving…' : undefined}
							disabled={categorizable.length === 0 || tooManyToCategorize || categorizingMany}
							choices={bulkChoices}
							optIn={{
								label: 'Approve them too',
								hint: 'Marks these Transactions reviewed. Balances already include them.',
								accepts: () => true
							}}
							onValueChange={(option: string, approveToo: boolean) =>
								categorizeSelected(option, approveToo)}
						/>
					</div>
				{/if}
				<Button
					variant={byPayee ? 'secondary' : 'outline'}
					aria-pressed={byPayee}
					onclick={() => (byPayee = !byPayee)}
				>
					<ListTreeIcon aria-hidden="true" />
					<span class="max-sm:sr-only">Group by Payee</span>
				</Button>
				<Button
					bind:ref={approveAllButton}
					variant="outline"
					aria-disabled={approveAllBlocked}
					onclick={approveEvery}
				>
					<CheckCheckIcon aria-hidden="true" />
					{#if selecting && selectedUnapproved.length > 0}
						<span class="text-left">
							Approve {selectedUnapproved.length}<span class="max-sm:sr-only">&nbsp;selected</span>
						</span>
					{:else}
						<span class={['text-left', !selecting && 'min-w-36']}>{approveAllLabel}</span>
					{/if}
				</Button>
			</div>
		</div>
		{#if unselectedNote !== '' || keptNote !== '' || tooManyToCategorize}
			<p class="mt-1 text-xs text-muted-foreground">
				{unselectedNote}
				{keptNote}
				{tooManyToCategorize ? `Categorize at most ${String(BULK_CATEGORIZE_LIMIT)} at once.` : ''}
			</p>
		{/if}
	</div>

	<div class={['@container', rows.length === 0 && !loading && 'hidden']}>
		<Table.Root layout="fixed">
			<colgroup><col class="w-8 sm:w-12" /></colgroup>
			<Table.Header labels="lg">
				<Table.Row>
					<Table.Head width="select"><span class="sr-only">Select</span></Table.Head>
					{#if !byPayee}
						<Table.Head width="date" showFrom="2xl">Date</Table.Head>
					{/if}
					{#if allAccounts}
						<Table.Head width="name" showFrom="5xl">Account</Table.Head>
					{/if}
					<Table.Head>{byPayee ? 'Date' : 'Payee'}</Table.Head>
					<Table.Head width="name" showFrom="4xl">Category</Table.Head>
					<Table.Head width="note" showFrom={memoFrom}>Memo</Table.Head>
					<Table.Head width="amount" align="end">Amount</Table.Head>
					<Table.Head width="check" align="center" showFrom="lg">Cleared</Table.Head>
					<Table.Head width="action" showFrom="2xl"
						><span class="sr-only">Approval</span></Table.Head
					>
				</Table.Row>
			</Table.Header>
			{#each sections as section (section.label)}
				{#if byPayee}
					{#if section.label !== ''}
						<Table.Body>{@render sectionHeading(section.label)}</Table.Body>
					{/if}
					{#each section.payees as group (group.key)}
						<Table.Body>
							{@render payeeHeading(group, section.label)}
							{#each group.rows as row (row._id)}
								{@render transactionRow(row)}
							{/each}
						</Table.Body>
					{/each}
				{:else}
					<Table.Body>
						{#if section.label !== ''}
							{@render sectionHeading(section.label)}
						{/if}
						{#each section.rows as row (row._id)}
							{@render transactionRow(row)}
						{/each}
					</Table.Body>
				{/if}
			{/each}
		</Table.Root>
	</div>
	{#if canShowMore}
		<div>
			<Button variant="outline" aria-disabled={more.status === 'LoadingMore'} onclick={showMore}>
				{more.status === 'LoadingMore' ? 'Loading…' : 'Show more'}
			</Button>
		</div>
	{/if}
</div>

<TransactionDialog
	bind:open={dialogOpen}
	transaction={editing}
	{preset}
	defaultAccountId={accountId}
	returnFocus={editingFocus}
	ondone={(message: string) => {
		retireUndoOf(editingSnapshot?._id);
		announce(message);
	}}
	ondeleted={(transactionId: Id<'transactions'>) => {
		deletedId = transactionId;
	}}
/>
<ImportDialog bind:open={importOpen} defaultAccountId={accountId} />

<AlertDialog.Root
	open={confirmRemoval !== null}
	onOpenChange={(next) => {
		if (!next) removal.dismiss();
	}}
>
	<AlertDialog.Content returnFocus={removalFocus}>
		<AlertDialog.Header>
			<AlertDialog.Title>
				{confirmRemoval?.row.transfer
					? 'Delete this Transfer too?'
					: 'Delete this Transaction too?'}
			</AlertDialog.Title>
			<AlertDialog.Description>
				{#if confirmRemoval?.row.transfer}
					The bank removed {confirmRemoval.payee}. Both sides are deleted, here and in {confirmRemoval
						.row.transfer.accountName}. This can't be undone.
				{:else}
					The bank removed {confirmRemoval?.payee}. Its amount comes out of the Account balance.
					This can't be undone.
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep it</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="destructive"
				disabled={resolving}
				onclick={async () => {
					const opening = removal.current;
					if (opening === null) return;
					const { row, importId, payee } = opening;
					const removed = await removal.run('save', () => resolveRow(row, importId, 'bank', payee));
					if (!removed.ok) return;
					afterRemoval = removed.value;
					removal.close(opening);
				}}>Delete</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
