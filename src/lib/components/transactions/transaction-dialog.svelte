<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useMutation, useQuery } from 'convex-svelte';
	import { untrack } from 'svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getAccounts } from '$lib/accounts.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { formatDate, localIsoDate } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';
	import { SPLIT_LINE_LIMIT } from '$lib/domain/splits';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import {
		addLine,
		choose,
		chooseLink,
		type Draft,
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
		defaultAccountId
	}: {
		open?: boolean;

		transaction?: Row | undefined;
		defaultAccountId?: Id<'accounts'> | undefined;
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

	const freshDraft = () =>
		openDraft({
			saved: transaction,
			defaultAccountId,
			accounts: accounts.all,
			today: localIsoDate(new Date())
		});
	let draft: Draft = $state(untrack(freshDraft));
	let error = $state('');
	const dialog = new DialogSession<object, 'write'>();
	const saving = $derived(dialog.pending('write'));
	let confirmDelete = $state(false);
	let confirmBankRemoval = $state<Id<'imports'> | null>(null);
	let unlocked = $state(false);

	const locked = $derived(transaction?.reconciled === true && !unlocked);
	const startingBalance = $derived(transaction?.startingBalance === true);

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

	$effect(() => {
		if (open) untrack(fill);
	});

	$effect(() => {
		if (!open || transaction === undefined) return;
		const live = { date: transaction.date, amount: transaction.amount };
		untrack(() => {
			draft = followSaved(draft, live);
		});
	});

	function fill() {
		dialog.open({});
		error = '';
		unlocked = false;
		draft = freshDraft();
	}

	async function write(
		work: () => PromiseLike<unknown>,
		failure: string,
		succeeded = () => {
			open = false;
		}
	) {
		const result = await dialog.run('write', work);
		confirmDelete = false;
		confirmBankRemoval = null;
		if (result.ok) succeeded();
		else error = result.error?.message ?? failure;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const { payload } = shown;
		if (payload.kind === 'waiting') return;
		if (payload.kind === 'invalid') {
			error = payload.message;
			return;
		}
		const { fields } = payload;
		const transactionId = transaction?._id;
		await write(
			() => (transactionId === undefined ? create(fields) : update({ transactionId, ...fields })),
			"Budge couldn't save the Transaction. Try again."
		);
	}

	async function approveTransaction() {
		if (!transaction) return;
		const transactionId = transaction._id;
		await write(
			() => approve({ transactionId }),
			"Budge couldn't approve the Transaction. Try again."
		);
	}

	async function unmatchRow(importId: Id<'imports'>) {
		await write(() => unmatch({ importId }), "Budge couldn't Unmatch the row. Try again.");
	}

	async function resolveBankRow(importId: Id<'imports'>, keep: 'bank' | 'mine') {
		await write(
			() => resolveBankChange({ importId, keep }),
			"Budge couldn't resolve the bank's change. Try again."
		);
	}

	async function unlockTransaction() {
		if (!transaction) return;
		const transactionId = transaction._id;
		await write(
			() => unlock({ transactionId }),
			"Budge couldn't unlock the Transaction. Try again.",
			() => {
				unlocked = true;
				error = '';
			}
		);
	}

	async function deleteTransaction() {
		if (!transaction) return;
		const transactionId = transaction._id;
		await write(
			() => remove({ transactionId }),
			"Budge couldn't delete the Transaction. Try again."
		);
	}
</script>

{#snippet categoryOptions(savedId: string | undefined, savedName: string | undefined)}
	{#if categories.data}
		{#if unlisted(categories.data, savedId) && savedId}
			<option value={savedId}>{savedName}</option>
		{/if}
		{#if categories.data.readyToAssignId !== null}
			<option value={categories.data.readyToAssignId}>Ready to Assign</option>
		{/if}
		{#each categories.data.groups as group (group._id)}
			<optgroup label={group.name}>
				{#each group.categories as category (category._id)}
					<option value={category._id}>{category.name}</option>
				{/each}
			</optgroup>
		{/each}
	{:else if savedId}
		<option value={savedId}>{savedName}</option>
	{/if}
{/snippet}

{#snippet splitLines()}
	<fieldset class="flex flex-col gap-3 rounded-lg border border-border p-3">
		<legend class="px-1 text-sm font-medium">Split lines</legend>
		<ol class="flex flex-col gap-3">
			{#each draft.lines as line, index (line.key)}
				{@const saved = savedCategoryOf(transaction, line.categoryId)}
				{@const number = index + 1}
				<li class="flex flex-col gap-2">
					<div class="flex items-end gap-2">
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<Label for={`split-category-${String(line.key)}`}>Line {number} Category</Label>
							<select
								id={`split-category-${String(line.key)}`}
								bind:value={line.categoryId}
								required
								class="h-8 min-w-0 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm"
							>
								<option value="" disabled>Pick a Category</option>
								{@render categoryOptions(saved?.id, saved?.name)}
							</select>
						</div>
						<div class="flex w-28 flex-col gap-1">
							<Label for={`split-amount-${String(line.key)}`}>Line {number} amount</Label>
							<Input
								id={`split-amount-${String(line.key)}`}
								bind:value={line.amount}
								inputmode="decimal"
								placeholder="0.00"
								autocomplete="off"
								required
							/>
						</div>
					</div>
					<div class="flex items-end gap-2">
						<div class="flex min-w-0 flex-1 flex-col gap-1">
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
		<div class="flex flex-wrap items-center justify-between gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={draft.lines.length >= SPLIT_LINE_LIMIT}
				onclick={() => {
					draft = addLine(draft);
				}}>Add line</Button
			>
			<p aria-live="polite" class="text-sm font-medium">
				{#if shown.remainder === undefined}
					Enter amounts such as 12.50 to see what is left.
				{:else if shown.remainder === 0 && shown.blankLine}
					Nothing left for the empty line
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

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{transaction ? 'Edit Transaction' : 'Add Transaction'}</Dialog.Title>
		</Dialog.Header>
		<form class="flex flex-col gap-4" onsubmit={submit}>
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
						onclick={unlockTransaction}
					>
						Unlock
					</Button>
				</div>
			{/if}
			<div class="flex flex-col gap-2">
				<Label for="transaction-account">Account</Label>
				<select
					id="transaction-account"
					bind:value={draft.accountId}
					disabled={locked || startingBalance}
					required
					class="h-8 rounded-lg border border-input bg-background px-2.5 text-base disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
				>
					{#each accounts.all as account (account._id)}
						<option value={account._id}>{account.name}</option>
					{/each}
				</select>
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
						disabled={startingBalance}
					/>
				</div>
			{/if}
			{#if startingBalance}
				<p class="text-sm text-muted-foreground">
					A starting balance stays in its Account, with no Payee and one Category.
				</p>
			{/if}
			<div class="flex flex-col gap-2">
				<Label for="transaction-category"
					>{startingBalance ? 'Category' : 'Category or Transfer'}</Label
				>
				<select
					id="transaction-category"
					bind:value={
						() => optionOf(shown.selection),
						(option: string) => {
							draft = choose(draft, option, world);
						}
					}
					class="h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm"
				>
					{#if shown.selection.kind === 'recalling' || shown.selection.kind === 'recallFailed'}
						<option value={optionOf(shown.selection)} disabled>
							{shown.selection.kind === 'recalling'
								? 'Looking up the last Category…'
								: 'Pick a Category'}
						</option>
					{/if}
					<option value={optionOf({ kind: 'uncategorized' })}>Uncategorized</option>
					{#if !startingBalance}
						<option value={optionOf({ kind: 'split' })}>Split across Categories</option>
					{/if}
					{@render categoryOptions(
						transaction?.categoryId ?? undefined,
						transaction?.categoryName ?? undefined
					)}
					{#if shown.transferAccounts.length > 0 && !startingBalance}
						<optgroup label="Transfer to or from">
							{#each shown.transferAccounts as account (account._id)}
								<option value={optionOf({ kind: 'transfer', accountId: account._id })}
									>Transfer: {account.name}</option
								>
							{/each}
						</optgroup>
					{/if}
				</select>
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
			<div class="flex flex-col gap-2">
				<Label for="transaction-amount">Amount</Label>
				<Input
					id="transaction-amount"
					bind:value={draft.amount}
					inputmode="decimal"
					placeholder="0.00"
					autocomplete="off"
					disabled={locked}
					required
				/>
			</div>
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
								{#if bankRow.state !== 'linked'}
									<div class="flex w-full flex-col gap-2 rounded-md border p-3">
										<p class="text-warning">
											{#if bankRow.state === 'changed'}
												Bank changed this: {formatCents(bankRow.amount)} on {formatDate(
													bankRow.date
												)}.
											{:else}
												Bank removed this.
											{/if}
										</p>
										<div class="flex flex-wrap gap-2">
											<Button
												type="button"
												size="sm"
												variant="outline"
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
			<p role="alert" class="min-h-6 text-sm text-destructive">{error}</p>
			<Dialog.Footer>
				{#if transaction && !locked}
					<Button
						type="button"
						variant="outline"
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
	<AlertDialog.Content>
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
			<AlertDialog.Action onclick={deleteTransaction} disabled={saving}>Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root
	open={confirmBankRemoval !== null}
	onOpenChange={(next) => {
		if (!next) confirmBankRemoval = null;
	}}
>
	<AlertDialog.Content>
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
				disabled={saving}
				onclick={() => {
					if (confirmBankRemoval !== null) void resolveBankRow(confirmBankRemoval, 'bank');
				}}>Delete</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
