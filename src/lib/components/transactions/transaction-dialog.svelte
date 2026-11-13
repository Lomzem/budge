<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useMutation, useQuery } from 'convex-svelte';
	import { tick, untrack } from 'svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getAccounts } from '$lib/accounts.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { Choices } from '$lib/components/choices';
	import SelectField from '$lib/components/select-field.svelte';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { formatDate, localIsoDate } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';
	import { SPLIT_LINE_LIMIT } from '$lib/domain/splits';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import {
		addLine,
		choose,
		chooseLink,
		fillRemainder,
		type Draft,
		type Field,
		followSaved,
		linkQuery,
		lookupOf,
		NEW_SIDE,
		openDraft,
		optionOf,
		recallQuery,
		removeLine,
		savedCategoryOf,
		unlisted,
		view,
		type World
	} from '$lib/transactionEditor';

	type Row = FunctionReturnType<typeof api.transactions.list>['page'][number];

	let {
		open = $bindable(false),
		transaction,
		defaultAccountId,
		returnFocus,
		ondone,
		ondeleted
	}: {
		open?: boolean;

		transaction?: Row | undefined;
		defaultAccountId?: Id<'accounts'> | undefined;

		returnFocus?: () => HTMLElement | undefined;

		ondone?: (message: string) => void;

		ondeleted?: (transactionId: Id<'transactions'>) => void;
	} = $props();

	const accounts = getAccounts();
	const create = useMutation(api.transactions.create);
	const update = useMutation(api.transactions.update);
	const remove = useMutation(api.transactions.remove);
	const approve = useMutation(api.transactions.approve);
	const unmatch = useMutation(api.imports.unmatch);
	const resolveBankChange = useMutation(api.imports.resolveBankChange);
	const unlock = useMutation(api.transactions.unlock);
	const categories = useQuery(api.categories.list, () => (open ? {} : 'skip'));
	const payees = useQuery(api.payees.list, () => (open ? {} : 'skip'));

	const freshDraft = () =>
		openDraft({
			saved: transaction,
			defaultAccountId,
			accounts: accounts.all,
			today: localIsoDate(new Date())
		});
	let draft: Draft = $state(untrack(freshDraft));
	let error = $state('');
	let invalidField = $state<string | undefined>();
	const dialog = new DialogSession<object, 'write'>();
	const saving = $derived(dialog.pending('write'));
	let confirmDelete = $state(false);
	let confirmBankRemoval = $state<Id<'imports'> | null>(null);
	let unlocked = $state(false);
	let confirmUnlock = $state(false);
	let confirmDiscard = $state(false);
	let pristine = '';
	let errorChecksDraft = false;

	const locked = $derived(transaction?.reconciled === true && !unlocked);
	const startingBalance = $derived(transaction?.startingBalance === true);
	let bankChangeAsActedOn = untrack(() => transaction);
	const bankChangeShown = $derived.by(() => {
		if (saving || !open) return bankChangeAsActedOn;
		bankChangeAsActedOn = transaction;
		return transaction;
	});
	const flagged = $derived(bankChangeShown?.bankRows.filter((row) => row.state !== 'linked') ?? []);
	let bankChange: HTMLElement | null = $state(null);

	const payeeMemory = useQuery(
		api.payees.lastCategory,
		() => (open ? recallQuery(draft) : undefined) ?? 'skip'
	);
	const world: World = $derived({
		saved: transaction,
		accounts: accounts.all,
		categories: lookupOf(categories),
		payeeMemory: lookupOf(payeeMemory)
	});
	const linkCandidates = useQuery(
		api.transactions.transferCandidates,
		() => (open ? linkQuery(draft, world) : undefined) ?? 'skip'
	);
	const shown = $derived(view(draft, world, lookupOf(linkCandidates)));
	const blankLine = $derived(draft.lines.some((line) => line.amount.trim() === ''));

	$effect(() => {
		if (open) untrack(fill);
	});

	$effect(() => {
		if (!open || transaction === undefined) return;
		const live = { date: transaction.date, amount: transaction.amount };
		untrack(() => {
			const untouched = !changed();
			draft = followSaved(draft, live);
			if (untouched) pristine = JSON.stringify(draft);
		});
	});

	function fill() {
		dialog.open({});
		error = '';
		invalidField = undefined;
		errorChecksDraft = false;
		unlocked = false;
		draft = freshDraft();
		pristine = JSON.stringify(draft);
	}

	function changed() {
		return JSON.stringify(draft) !== pristine;
	}

	function requestOpen(next: boolean) {
		if (!next && open && !saving && changed()) {
			confirmDiscard = true;
			return;
		}
		open = next;
	}

	function discard() {
		confirmDiscard = false;
		open = false;
	}

	$effect(() => {
		const { payload } = shown;
		untrack(() => {
			if (!errorChecksDraft || payload.kind === 'waiting') return;
			error = payload.kind === 'invalid' ? payload.message : '';
			invalidField = payload.kind === 'invalid' ? idOf(payload.field) : undefined;
		});
	});

	function idOf(field: Field) {
		switch (field.kind) {
			case 'account':
				return 'transaction-account';
			case 'amount':
				return 'transaction-amount';
			case 'category':
				return 'transaction-category';
			case 'lineCategory':
				return `split-category-${String(field.key)}`;
			case 'lineAmount':
				return `split-amount-${String(field.key)}`;
		}
	}

	function marked(id: string) {
		return invalidField === id
			? { 'aria-invalid': true, 'aria-describedby': 'transaction-error' }
			: {};
	}

	async function addSplitLine() {
		draft = addLine(draft);
		errorChecksDraft = false;
		error = '';
		invalidField = undefined;
		await tick();
		const added = draft.lines.at(-1);
		if (added) document.getElementById(`split-category-${String(added.key)}`)?.focus();
	}

	function categoryChoices(savedId: string | undefined, savedName: string | undefined): Choices {
		const data = categories.data;
		const saved = savedId !== undefined && (!data || unlisted(data, savedId));
		return [
			...(saved ? [{ value: savedId, label: savedName ?? '' }] : []),
			...(data?.readyToAssignId ? [{ value: data.readyToAssignId, label: 'Ready to Assign' }] : []),
			...(data?.groups ?? []).map((group) => ({
				group: group.name,
				choices: group.categories.map((category) => ({ value: category._id, label: category.name }))
			}))
		];
	}

	function selectionChoices(): Choices {
		const { selection, transferAccounts } = shown;
		const looking = selection.kind === 'recalling' || selection.kind === 'recallFailed';
		return [
			...(looking
				? [
						{
							value: optionOf(selection),
							label:
								selection.kind === 'recalling'
									? 'Looking up the last Category…'
									: 'Pick a Category',
							disabled: true
						}
					]
				: []),
			{ value: optionOf({ kind: 'uncategorized' }), label: 'Uncategorized' },
			...(startingBalance
				? []
				: [{ value: optionOf({ kind: 'split' }), label: 'Split across Categories' }]),
			...categoryChoices(
				transaction?.categoryId ?? undefined,
				transaction?.categoryName ?? undefined
			),
			...(transferAccounts.length > 0 && !startingBalance
				? [
						{
							group: 'Transfer to or from',
							choices: transferAccounts.map((account) => ({
								value: optionOf({ kind: 'transfer', accountId: account._id }),
								label: `Transfer: ${account.name}`
							}))
						}
					]
				: [])
		];
	}

	function moveToAmount(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		document.getElementById('transaction-amount')?.focus();
	}

	async function write(
		work: () => PromiseLike<unknown>,
		failure: string,
		done: string,
		succeeded = () => {
			open = false;
		}
	) {
		const result = await dialog.run('write', work);
		errorChecksDraft = false;
		invalidField = undefined;
		confirmDelete = false;
		confirmUnlock = false;
		confirmBankRemoval = null;
		if (result.ok) {
			succeeded();
			ondone?.(done);
		} else error = result.error?.message ?? failure;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const { payload } = shown;
		if (payload.kind === 'waiting') return;
		if (payload.kind === 'invalid') {
			error = payload.message;
			errorChecksDraft = true;
			const id = idOf(payload.field);
			invalidField = id;
			await tick();
			document.getElementById(id)?.focus();
			return;
		}
		const { fields } = payload;
		const transactionId = transaction?._id;
		await write(
			() => (transactionId === undefined ? create(fields) : update({ transactionId, ...fields })),
			"Budge couldn't save the Transaction. Try again.",
			transactionId === undefined ? 'Transaction added' : 'Transaction saved'
		);
	}

	async function approveTransaction() {
		if (!transaction) return;
		const transactionId = transaction._id;
		await write(
			() => approve({ transactionId }),
			"Budge couldn't approve the Transaction. Try again.",
			'Transaction approved'
		);
	}

	async function unmatchRow(importId: Id<'imports'>) {
		await write(
			() => unmatch({ importId }),
			"Budge couldn't Unmatch the row. Try again.",
			'Bank Row unmatched'
		);
	}

	async function resolveBankRow(importId: Id<'imports'>, keep: 'bank' | 'mine') {
		await write(
			() => resolveBankChange({ importId, keep }),
			"Budge couldn't resolve the bank's change. Try again.",
			keep === 'bank' ? "Took the bank's version" : 'Kept your version'
		);
	}

	async function unlockTransaction() {
		if (!transaction) return;
		const transactionId = transaction._id;
		await write(
			() => unlock({ transactionId }),
			"Budge couldn't unlock the Transaction. Try again.",
			'Transaction unlocked',
			() => {
				unlocked = true;
				error = '';
			}
		);
	}

	function focusAfterConfirm(event: Event) {
		if (open) return;
		event.preventDefault();
		returnFocus?.()?.focus();
	}

	async function deleteTransaction() {
		if (!transaction) return;
		const transactionId = transaction._id;
		await write(
			() => remove({ transactionId }),
			"Budge couldn't delete the Transaction. Try again.",
			'Transaction deleted',
			() => {
				ondeleted?.(transactionId);
				open = false;
			}
		);
	}
</script>

{#snippet splitLines()}
	<fieldset class="flex flex-col gap-3 rounded-lg border border-border p-3">
		<legend class="px-1 text-sm font-medium">Split lines</legend>
		<ol class="flex flex-col gap-3">
			{#each draft.lines as line, index (line.key)}
				{@const saved = savedCategoryOf(transaction, line.categoryId)}
				{@const number = index + 1}
				<li class="flex flex-col gap-2">
					<div class="flex flex-wrap items-end gap-2">
						<div class="flex min-w-40 flex-1 flex-col gap-1">
							<Label for={`split-category-${String(line.key)}`}>Line {number} Category</Label>
							<SelectField
								id={`split-category-${String(line.key)}`}
								required
								bind:value={line.categoryId}
								{...marked(`split-category-${String(line.key)}`)}
								placeholder="Pick a Category"
								choices={categoryChoices(saved?.id, saved?.name)}
							/>
						</div>
						<div class="flex w-28 flex-col gap-1">
							<Label for={`split-amount-${String(line.key)}`}>Line {number} amount</Label>
							<Input
								id={`split-amount-${String(line.key)}`}
								bind:value={line.amount}
								{...marked(`split-amount-${String(line.key)}`)}
								inputmode="decimal"
								placeholder="0.00"
								autocomplete="off"
								required
								onfocus={async (event: FocusEvent) => {
									const target = event.currentTarget as HTMLInputElement;
									draft = fillRemainder(draft, line.key);
									await tick();
									target.select();
								}}
							/>
						</div>
					</div>
					<div class="flex flex-wrap items-end gap-2">
						<div class="flex min-w-40 flex-1 flex-col gap-1">
							<Label for={`split-memo-${String(line.key)}`}>Line {number} memo</Label>
							<Input
								id={`split-memo-${String(line.key)}`}
								bind:value={line.memo}
								autocomplete="off"
							/>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={draft.lines.length <= 2}
							onclick={() => {
								draft = removeLine(draft, line.key);
							}}
						>
							Remove<span class="sr-only"> line {number}</span>
						</Button>
					</div>
				</li>
			{/each}
		</ol>
		<div class="flex items-center justify-between gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={draft.lines.length >= SPLIT_LINE_LIMIT}
				onclick={addSplitLine}>Add line</Button
			>
			<p aria-live="polite" class="min-w-0 text-right text-sm font-medium">
				{#if shown.remainder === undefined}
					Enter amounts to see what's left.
				{:else if shown.remainder === 0 && blankLine}
					$0.00 left to split
				{:else if shown.remainder === 0}
					Fully split
				{:else if shown.remainder > 0}
					{formatCents(shown.remainder)} left to split
				{:else}
					{formatCents(-shown.remainder)} over the amount
				{/if}
			</p>
		</div>
		<p class="text-sm text-muted-foreground">
			Line amounts follow the Direction; a minus sign turns a line the other way.
		</p>
	</fieldset>
{/snippet}

<Dialog.Root bind:open={() => open, requestOpen}>
	<Dialog.Content
		onOpenAutoFocus={(event: Event) => {
			if (bankChange !== null) {
				event.preventDefault();
				bankChange.focus();
				return;
			}
			if (transaction !== undefined || defaultAccountId === undefined) return;
			event.preventDefault();
			document.getElementById('transaction-payee')?.focus();
		}}
		onCloseAutoFocus={(event: Event) => {
			const target = returnFocus?.();
			if (target === undefined) return;
			event.preventDefault();
			target.focus();
		}}
	>
		<Dialog.Header>
			<Dialog.Title>{transaction ? 'Edit Transaction' : 'Add Transaction'}</Dialog.Title>
		</Dialog.Header>
		<form class="flex flex-col gap-3 sm:gap-4" novalidate onsubmit={submit}>
			{#if flagged.length > 0}
				<section
					bind:this={bankChange}
					tabindex="-1"
					aria-labelledby="transaction-bank-change"
					class="flex flex-col gap-3 rounded-lg bg-warning-tint p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
				>
					<h3 id="transaction-bank-change" class="font-medium text-warning">
						{flagged.every((row) => row.state === 'removed')
							? 'Your bank removed this Transaction'
							: 'Your bank changed this Transaction'}
					</h3>
					{#each flagged as bankRow (bankRow._id)}
						<div class="flex flex-col gap-2">
							{#if bankRow.state === 'changed'}
								<div class="flex flex-col gap-0.5">
									<p>
										The bank now says <strong class="tabular-nums"
											>{formatCents(bankRow.amount)}</strong
										>
										on {formatDate(bankRow.date)}.
									</p>
									{#if bankChangeShown}
										<p>
											You have <strong class="tabular-nums"
												>{formatCents(bankChangeShown.amount)}</strong
											>
											on {formatDate(bankChangeShown.date)}.
										</p>
									{/if}
								</div>
							{:else if flagged.length > 1}
								<p>The bank removed it.</p>
							{/if}
							<p class="text-muted-foreground">Bank Text: {bankRow.bankText}</p>
							<div class="flex flex-wrap gap-2">
								<Button
									type="button"
									size="sm"
									disabled={saving}
									onclick={() => {
										if (bankRow.state === 'changed') void resolveBankRow(bankRow._id, 'bank');
										else confirmBankRemoval = bankRow._id;
									}}
								>
									{bankRow.state === 'changed' ? "Use the bank's version" : 'Delete it'}
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									disabled={saving}
									onclick={() => resolveBankRow(bankRow._id, 'mine')}
								>
									Keep mine
								</Button>
							</div>
						</div>
					{/each}
				</section>
			{/if}
			{#if locked}
				<div class="flex flex-wrap items-center justify-between gap-2 text-sm">
					<p class="text-muted-foreground">
						Reconciled: its Account, date, and amount are locked, and it can't be deleted.
					</p>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={saving}
						onclick={() => (confirmUnlock = true)}
					>
						Unlock
					</Button>
				</div>
			{:else if unlocked}
				<p role="status" class="text-sm text-muted-foreground">
					Unlocked: it's no longer Reconciled. Reconcile the Account again to lock it.
				</p>
			{/if}
			<div class="flex flex-col gap-2">
				<Label for="transaction-account">Account</Label>
				<SelectField
					id="transaction-account"
					required
					bind:value={draft.accountId}
					disabled={locked || startingBalance}
					{...marked('transaction-account')}
					placeholder="Pick an Account"
					choices={accounts.all.map((account) => ({ value: account._id, label: account.name }))}
				/>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="transaction-date">Date</Label>
				<Input
					id="transaction-date"
					type="date"
					bind:value={draft.date}
					disabled={locked}
					required
				/>
			</div>
			{#if shown.selection.kind !== 'transfer'}
				<div class="flex flex-col gap-2">
					<Label for="transaction-payee">Payee</Label>
					<Input
						id="transaction-payee"
						bind:value={draft.payee}
						autocomplete="off"
						list="transaction-payees"
						disabled={startingBalance}
						onkeydown={moveToAmount}
					/>
					<datalist id="transaction-payees">
						{#each payees.data ?? [] as payee (payee._id)}
							<option value={payee.name}></option>
						{/each}
					</datalist>
				</div>
			{/if}
			{#if startingBalance}
				<p class="text-sm text-muted-foreground">
					A starting balance stays in its Account, with no Payee and one Category.
				</p>
			{/if}
			<div class="flex items-start gap-6">
				<fieldset>
					<legend class="mb-2 text-sm font-medium">Direction</legend>
					<RadioGroup.Root bind:value={draft.direction} disabled={locked}>
						<div class="flex items-center gap-2">
							<RadioGroup.Item value="outflow" id="transaction-outflow" />
							<Label for="transaction-outflow">Outflow</Label>
						</div>
						<div class="flex items-center gap-2">
							<RadioGroup.Item value="inflow" id="transaction-inflow" />
							<Label for="transaction-inflow">Inflow</Label>
						</div>
					</RadioGroup.Root>
				</fieldset>
				<div class="flex min-w-0 flex-1 flex-col gap-2">
					<Label for="transaction-amount">Amount</Label>
					<Input
						id="transaction-amount"
						bind:value={draft.amount}
						{...marked('transaction-amount')}
						inputmode="decimal"
						placeholder="0.00"
						autocomplete="off"
						disabled={locked}
						required
					/>
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="transaction-category"
					>{startingBalance ? 'Category' : 'Category or Transfer'}</Label
				>
				<SelectField
					id="transaction-category"
					bind:value={
						() => optionOf(shown.selection),
						(option: string) => {
							draft = choose(draft, option, world);
						}
					}
					{...marked('transaction-category')}
					choices={selectionChoices()}
				/>
				{#if shown.selection.kind === 'recallFailed'}
					<p class="text-sm text-destructive" role="alert">{shown.selection.message}</p>
				{/if}
				{#if shown.selection.kind === 'split'}
					{@render splitLines()}
				{/if}
				{#if shown.selection.kind === 'transfer'}
					<p class="text-sm text-muted-foreground">
						{#if shown.cardPayment}
							A card payment moves money from the Cash Account into the card.
						{/if}
						The other side is kept in step: editing or deleting one side changes both.
					</p>
				{/if}
			</div>
			{#if shown.candidates.length > 0}
				<fieldset>
					<legend class="mb-2 text-sm font-medium">Other side</legend>
					<RadioGroup.Root
						bind:value={
							() => shown.link,
							(link: string) => {
								draft = chooseLink(draft, link);
							}
						}
					>
						{#each shown.candidates as candidate (candidate._id)}
							<div class="flex items-center gap-2">
								<RadioGroup.Item value={candidate._id} id={`transfer-link-${candidate._id}`} />
								<Label for={`transfer-link-${candidate._id}`}>
									Link the import {candidate.payeeName ?? ''} on {formatDate(candidate.date)},
									{formatCents(candidate.amount)}
								</Label>
							</div>
						{/each}
						<div class="flex items-center gap-2">
							<RadioGroup.Item value={NEW_SIDE} id="transfer-link-new" />
							<Label for="transfer-link-new">Create a new uncleared side</Label>
						</div>
					</RadioGroup.Root>
				</fieldset>
			{/if}
			<div class="flex flex-col gap-2">
				<Label for="transaction-memo">Memo</Label>
				<Input id="transaction-memo" bind:value={draft.memo} autocomplete="off" />
			</div>
			{#if transaction && transaction.bankRows.length > 0}
				<section aria-labelledby="transaction-bank-text" class="flex flex-col gap-2">
					<h3 id="transaction-bank-text" class="text-sm font-medium">Bank Text</h3>
					<ul class="flex flex-col gap-2">
						{#each transaction.bankRows as bankRow (bankRow._id)}
							<li class="flex flex-wrap items-center justify-between gap-2 text-sm">
								<span class="min-w-0 break-words text-muted-foreground">{bankRow.bankText}</span>
								{#if bankRow.matched && bankRow.state !== 'removed'}
									<Button
										type="button"
										size="sm"
										variant="outline"
										disabled={saving}
										onclick={() => unmatchRow(bankRow._id)}
									>
										Unmatch
									</Button>
								{/if}
							</li>
						{/each}
					</ul>
					{#if transaction.moreBankRows}
						<p class="text-sm text-muted-foreground">
							More Bank Rows back this Transaction than are shown here. Flagged ones come first, and
							search still finds every Bank Text.
						</p>
					{/if}
				</section>
			{/if}
			<Dialog.Footer {error} errorId="transaction-error">
				{#if transaction && !locked}
					<Button
						type="button"
						variant="destructive"
						disabled={saving}
						onclick={() => (confirmDelete = true)}
					>
						Delete
					</Button>
				{/if}
				{#if transaction && !transaction.approved}
					<Button type="button" variant="outline" disabled={saving} onclick={approveTransaction}>
						Approve
					</Button>
				{/if}
				<Button type="submit" disabled={saving || shown.payload.kind === 'waiting'}>Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={confirmDelete}>
	<AlertDialog.Content onCloseAutoFocus={focusAfterConfirm}>
		<AlertDialog.Header>
			<AlertDialog.Title>
				{transaction?.transfer ? 'Delete this Transfer?' : 'Delete this Transaction?'}
			</AlertDialog.Title>
			<AlertDialog.Description>
				{#if transaction?.transfer}
					Both sides are deleted, here and in {transaction.transfer.accountName}. This can't be
					undone.
				{:else}
					Its amount comes out of the Account balance. This can't be undone.
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep it</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" onclick={deleteTransaction} disabled={saving}
				>Delete</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root
	open={confirmBankRemoval !== null}
	onOpenChange={(next) => {
		if (!next) confirmBankRemoval = null;
	}}
>
	<AlertDialog.Content onCloseAutoFocus={focusAfterConfirm}>
		<AlertDialog.Header>
			<AlertDialog.Title>
				{transaction?.transfer ? 'Delete this Transfer too?' : 'Delete this Transaction too?'}
			</AlertDialog.Title>
			<AlertDialog.Description>
				{#if transaction?.transfer}
					The bank removed it. Both sides are deleted, here and in {transaction.transfer
						.accountName}. This can't be undone.
				{:else}
					The bank removed it. Its amount comes out of the Account balance. This can't be undone.
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep it</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="destructive"
				disabled={saving}
				onclick={() => {
					if (confirmBankRemoval !== null) void resolveBankRow(confirmBankRemoval, 'bank');
				}}>Delete</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={confirmUnlock}>
	<AlertDialog.Content onCloseAutoFocus={focusAfterConfirm}>
		<AlertDialog.Header>
			<AlertDialog.Title>Unlock this Transaction?</AlertDialog.Title>
			<AlertDialog.Description>
				It stops being Reconciled right away, so its Account, date and amount can change and it can
				be deleted. Reconcile the Account again to lock it.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep it locked</AlertDialog.Cancel>
			<AlertDialog.Action onclick={unlockTransaction} disabled={saving}>Unlock</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={confirmDiscard}>
	<AlertDialog.Content onCloseAutoFocus={focusAfterConfirm}>
		<AlertDialog.Header>
			<AlertDialog.Title>Discard your changes?</AlertDialog.Title>
			<AlertDialog.Description>
				{transaction ? 'Your edits to this Transaction' : 'This new Transaction'} won't be saved.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" onclick={discard}>Discard</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
