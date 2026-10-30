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
	import { localIsoDate } from '$lib/domain/dates';
	import { formatCents, parseCents } from '$lib/domain/money';
	import { readPublicError } from '$lib/publicError';

	type Row = FunctionReturnType<typeof api.transactions.list>['page'][number];

	let {
		open = $bindable(false),
		transaction,
		defaultAccountId
	}: {
		open?: boolean;
		/** The Transaction to edit; left out to add one. */
		transaction?: Row | undefined;
		defaultAccountId?: Id<'accounts'> | undefined;
	} = $props();

	const accounts = getAccounts();
	const create = useMutation(api.transactions.create);
	const update = useMutation(api.transactions.update);
	const remove = useMutation(api.transactions.remove);
	const approve = useMutation(api.transactions.approve);
	const unmatch = useMutation(api.imports.unmatch);
	const categories = useQuery(api.categories.list, () => (open ? {} : 'skip'));

	let accountId = $state('');
	let date = $state('');
	let payee = $state('');
	/**
	 * A Category ID, `''` for Uncategorized, `split` for a split, or `transfer:` and the other
	 * Account's ID.
	 */
	let categoryId = $state('');
	/** A split's lines. Amounts follow the Direction; a minus sign turns a line the other way. */
	let lines: { key: number; categoryId: string; amount: string; memo: string }[] = $state([]);
	let nextLineKey = 0;
	let direction: 'outflow' | 'inflow' = $state('outflow');
	let amount = $state('');
	let memo = $state('');
	let error = $state('');
	let saving = $state(false);
	let confirmDelete = $state(false);

	const TRANSFER = 'transfer:';
	const SPLIT = 'split';
	const isSplit = $derived(categoryId === SPLIT);
	/** What is left to split, in the Direction's terms, or `undefined` while an amount isn't one. */
	const remainder = $derived.by(() => {
		const total = parseCents(amount);
		if (total === undefined) return undefined;
		let left = Math.abs(total);
		for (const line of lines) {
			// A line not filled in yet holds nothing.
			const cents = line.amount.trim() === '' ? 0 : parseCents(line.amount);
			if (cents === undefined) return undefined;
			left -= cents;
		}
		return left;
	});
	/** The other Account picked for a Transfer, or `undefined` for an ordinary Transaction. */
	const transferAccountId = $derived(
		categoryId.startsWith(TRANSFER) ? categoryId.slice(TRANSFER.length) : undefined
	);
	const isCash = $derived(accounts.cash.some((account) => account._id === accountId));
	// A Transfer is between two Cash Accounts, or a card payment from a Cash Account into a card.
	const transferAccounts = $derived(
		isCash ? accounts.all.filter((account) => account._id !== accountId) : accounts.cash
	);
	const isTransfer = $derived(transferAccountId !== undefined);
	/** A card payment: money leaves the Cash Account and goes into the card. */
	const isCardPayment = $derived(
		transferAccountId !== undefined &&
			!(isCash && accounts.cash.some((account) => account._id === transferAccountId))
	);
	// A Payment Category isn't offered, so keep a card's starting debt in the one it sits in.
	const isUnlisted = (id: string | null | undefined) =>
		id !== null &&
		id !== undefined &&
		categories.data !== undefined &&
		id !== categories.data.readyToAssignId &&
		!categories.data.groups.some((group) => group.categories.some((c) => c._id === id));

	// Fill the form each time the dialog opens, and only then: live updates to the Accounts
	// must not wipe what the owner is typing.
	$effect(() => {
		if (open) untrack(fill);
	});

	function fill() {
		error = '';
		if (transaction) {
			accountId = transaction.accountId;
			date = transaction.date;
			payee = transaction.payeeName ?? '';
			categoryId = transaction.transfer
				? TRANSFER + transaction.transfer.accountId
				: transaction.splits
					? SPLIT
					: (transaction.categoryId ?? '');
			direction = transaction.amount < 0 ? 'outflow' : 'inflow';
			amount = formatCents(Math.abs(transaction.amount)).replace('$', '');
			memo = transaction.memo ?? '';
			const sign = transaction.amount < 0 ? -1 : 1;
			lines = (transaction.splits ?? []).map((line) => ({
				key: nextLineKey++,
				categoryId: line.categoryId,
				amount: formatCents(sign * line.amount).replace('$', ''),
				memo: line.memo ?? ''
			}));
		} else {
			accountId = defaultAccountId ?? accounts.all[0]?._id ?? '';
			date = localIsoDate(new Date());
			payee = '';
			categoryId = '';
			direction = 'outflow';
			amount = '';
			memo = '';
			lines = [];
		}
	}

	function addLine(lineAmount = '') {
		lines.push({ key: nextLineKey++, categoryId: '', amount: lineAmount, memo: '' });
	}

	/** Picking Split starts two lines, the first holding the whole amount and any Category. */
	function startSplit(previous: string) {
		if (lines.length > 0) return;
		addLine(amount);
		addLine();
		const first = lines[0];
		if (first && previous !== '' && !previous.startsWith(TRANSFER)) first.categoryId = previous;
	}

	/** The Category picked, or `undefined` for Uncategorized. */
	function findCategory(id: string): Id<'categories'> | undefined {
		if (id === '') return undefined;
		const list = categories.data;
		if (id === transaction?.categoryId) return transaction.categoryId;
		const savedLine = transaction?.splits?.find((line) => line.categoryId === id);
		if (savedLine) return savedLine.categoryId;
		if (!list) return undefined;
		if (id === list.readyToAssignId) return list.readyToAssignId;
		return list.groups.flatMap((group) => group.categories).find((c) => c._id === id)?._id;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const account = accounts.find(accountId);
		const cents = parseCents(amount);
		if (!account) {
			error = 'Pick an Account.';
			return;
		}
		if (cents === undefined) {
			error = 'Enter the amount, such as 12.50.';
			return;
		}
		const shared = {
			accountId: account._id,
			date,
			amount: direction === 'outflow' ? -Math.abs(cents) : Math.abs(cents),
			memo
		};
		let fields;
		if (isSplit) {
			const splits = [];
			for (const line of lines) {
				const category = findCategory(line.categoryId);
				const cents = parseCents(line.amount);
				if (category === undefined) {
					error = 'Pick a Category for each line.';
					return;
				}
				if (cents === undefined) {
					error = "Enter each line's amount, such as 12.50.";
					return;
				}
				const signed = direction === 'outflow' ? -cents : cents;
				splits.push({ categoryId: category, amount: signed, memo: line.memo });
			}
			if (splits.length < 2) {
				error = 'A split needs two or more lines.';
				return;
			}
			if (remainder !== 0) {
				error = 'The lines must add up to the amount.';
				return;
			}
			fields = { ...shared, payee, splits };
		} else if (transferAccountId === undefined) {
			const category = findCategory(categoryId);
			fields = { ...shared, payee, ...(category === undefined ? {} : { categoryId: category }) };
		} else {
			const other = transferAccounts.find((a) => a._id === transferAccountId);
			if (!other) {
				error = 'Pick another Account to transfer with.';
				return;
			}
			// A Transfer has no Payee or Category.
			fields = { ...shared, payee: '', transferAccountId: other._id };
		}
		saving = true;
		try {
			if (transaction) await update({ transactionId: transaction._id, ...fields });
			else await create(fields);
			open = false;
		} catch (thrown) {
			error = readPublicError(thrown)?.message ?? "Budge couldn't save the Transaction. Try again.";
		} finally {
			saving = false;
		}
	}

	async function approveTransaction() {
		if (!transaction) return;
		saving = true;
		try {
			await approve({ transactionId: transaction._id });
			open = false;
		} catch (thrown) {
			error =
				readPublicError(thrown)?.message ?? "Budge couldn't approve the Transaction. Try again.";
		} finally {
			saving = false;
		}
	}

	/** Splits a Matched Bank Row back into its own Transaction. */
	async function unmatchRow(importId: Id<'imports'>) {
		saving = true;
		try {
			await unmatch({ importId });
			open = false;
		} catch (thrown) {
			error = readPublicError(thrown)?.message ?? "Budge couldn't Unmatch the row. Try again.";
		} finally {
			saving = false;
		}
	}

	async function deleteTransaction() {
		if (!transaction) return;
		saving = true;
		try {
			await remove({ transactionId: transaction._id });
			confirmDelete = false;
			open = false;
		} catch (thrown) {
			confirmDelete = false;
			error =
				readPublicError(thrown)?.message ?? "Budge couldn't delete the Transaction. Try again.";
		} finally {
			saving = false;
		}
	}
</script>

{#snippet categoryOptions(savedId: string | undefined, savedName: string | undefined)}
	{#if categories.data}
		{#if isUnlisted(savedId) && savedId}
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
		<!-- Keeps the saved Category selected while the list loads. -->
		<option value={savedId}>{savedName}</option>
	{/if}
{/snippet}

{#snippet splitLines()}
	<fieldset class="flex flex-col gap-3 rounded-lg border border-border p-3">
		<legend class="px-1 text-sm font-medium">Split lines</legend>
		<ol class="flex flex-col gap-3">
			{#each lines as line, index (line.key)}
				{@const saved = transaction?.splits?.find((s) => s.categoryId === line.categoryId)}
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
								{@render categoryOptions(saved?.categoryId, saved?.categoryName)}
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
							disabled={lines.length <= 2}
							onclick={() => lines.splice(index, 1)}
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
				onclick={() => {
					addLine();
				}}>Add line</Button
			>
			<p aria-live="polite" class="text-sm font-medium">
				{#if remainder === undefined}
					Enter amounts such as 12.50 to see what is left.
				{:else if remainder === 0}
					Fully split
				{:else if remainder > 0}
					{formatCents(remainder)} left to split
				{:else}
					{formatCents(-remainder)} over the amount
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
			<div class="flex flex-col gap-2">
				<Label for="transaction-account">Account</Label>
				<select
					id="transaction-account"
					bind:value={accountId}
					required
					class="h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm"
				>
					{#each accounts.all as account (account._id)}
						<option value={account._id}>{account.name}</option>
					{/each}
				</select>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="transaction-date">Date</Label>
				<Input id="transaction-date" type="date" bind:value={date} required />
			</div>
			{#if !isTransfer}
				<div class="flex flex-col gap-2">
					<Label for="transaction-payee">Payee</Label>
					<Input id="transaction-payee" bind:value={payee} autocomplete="off" />
				</div>
			{/if}
			<div class="flex flex-col gap-2">
				<Label for="transaction-category">Category or Transfer</Label>
				<select
					id="transaction-category"
					bind:value={
						() => categoryId,
						(next: string) => {
							if (next === SPLIT) startSplit(categoryId);
							categoryId = next;
						}
					}
					onchange={() => {
						if (isCardPayment) direction = isCash ? 'outflow' : 'inflow';
					}}
					class="h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm"
				>
					<option value="">Uncategorized</option>
					<option value={SPLIT}>Split across Categories</option>
					{@render categoryOptions(
						transaction?.categoryId ?? undefined,
						transaction?.categoryName ?? undefined
					)}
					{#if transferAccounts.length > 0}
						<optgroup label="Transfer to or from">
							{#each transferAccounts as account (account._id)}
								<option value={TRANSFER + account._id}>Transfer: {account.name}</option>
							{/each}
						</optgroup>
					{/if}
				</select>
				{#if isSplit}
					{@render splitLines()}
				{/if}
				{#if isTransfer}
					<p class="text-sm text-muted-foreground">
						{#if isCardPayment}
							A card payment moves money from the Cash Account into the card.
						{/if}
						The other side is kept in step: editing or deleting one side changes both.
					</p>
				{/if}
			</div>
			<fieldset>
				<legend class="mb-2 text-sm font-medium">Direction</legend>
				<RadioGroup.Root bind:value={direction}>
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
					bind:value={amount}
					inputmode="decimal"
					placeholder="0.00"
					autocomplete="off"
					required
				/>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="transaction-memo">Memo</Label>
				<Input id="transaction-memo" bind:value={memo} autocomplete="off" />
			</div>
			{#if transaction && transaction.bankRows.length > 0}
				<section aria-labelledby="transaction-bank-text" class="flex flex-col gap-2">
					<h3 id="transaction-bank-text" class="text-sm font-medium">Bank Text</h3>
					<ul class="flex flex-col gap-2">
						{#each transaction.bankRows as bankRow (bankRow._id)}
							<li class="flex flex-wrap items-center justify-between gap-2 text-sm">
								<span class="min-w-0 break-words text-muted-foreground">{bankRow.bankText}</span>
								{#if bankRow.matched}
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
				</section>
			{/if}
			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}
			<Dialog.Footer>
				{#if transaction}
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
				<Button type="submit" disabled={saving}>Save</Button>
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
