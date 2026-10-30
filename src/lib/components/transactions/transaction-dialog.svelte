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
	import { formatDate, isIsoDate, localIsoDate } from '$lib/domain/dates';
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
	 * What the form opened with or the owner picked: a Category ID, `''` for Uncategorized, or
	 * `transfer:` and the other Account's ID. Payee memory can stand in for it until the owner picks.
	 */
	let chosenCategoryId = $state('');
	let direction: 'outflow' | 'inflow' = $state('outflow');
	let amount = $state('');
	let memo = $state('');
	let error = $state('');
	let saving = $state(false);
	let confirmDelete = $state(false);
	/** The Payee and Category the form opened with. */
	let filledPayee = $state('');
	let filledCategoryId = $state('');
	/** Whether the owner has picked a Category since the form opened. */
	let categoryPicked = $state(false);

	// Payee memory: typing a Payee fills in the Category it was last given, until the owner picks
	// one. A Transaction that already has a Category keeps it.
	const prefillsCategory = $derived(open && !categoryPicked && filledCategoryId === '');
	const payeeName = $derived(payee.trim());
	const payeeEdited = $derived(payeeName !== '' && payeeName !== filledPayee);
	const payeeMemory = useQuery(api.payees.lastCategory, () =>
		prefillsCategory && payeeEdited ? { name: payeeName } : 'skip'
	);
	const recallsCategory = $derived(prefillsCategory && payeeEdited);
	/** Whether the Category the typed Payee was last given, or the list it is in, is on its way. */
	const recallingCategory = $derived(
		recallsCategory &&
			(payeeMemory.isLoading ||
				payeeMemory.isStale ||
				(Boolean(payeeMemory.data) && categories.data === undefined))
	);
	const recallFailed = $derived(
		recallsCategory && !recallingCategory && payeeMemory.error !== undefined
	);
	/** Stands in for a Category until the typed Payee's memory arrives or the owner picks one. */
	const UNRESOLVED = 'unresolved';
	// Neither the previous Payee's Category nor Uncategorized stands in while the typed Payee's own
	// memory is on its way or failed, so Save waits for it or for the owner's pick.
	const rememberedCategoryId = $derived(
		!recallsCategory
			? ''
			: recallingCategory || recallFailed
				? UNRESOLVED
				: payeeMemory.data
					? (findCategory(payeeMemory.data) ?? '')
					: ''
	);
	/** The Category or Transfer the form saves; see `chosenCategoryId`. */
	const categoryId = $derived(prefillsCategory ? rememberedCategoryId : chosenCategoryId);

	const TRANSFER = 'transfer:';
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
	const savedCategoryUnlisted = $derived(
		transaction?.categoryId !== undefined &&
			categories.data !== undefined &&
			transaction.categoryId !== categories.data.readyToAssignId &&
			!categories.data.groups.some((group) =>
				group.categories.some((c) => c._id === transaction.categoryId)
			)
	);

	const LINK_NONE = 'new';
	/** What the owner picked for the other side; left unset, Budge picks. */
	let linkChoice: string | undefined = $state();
	const signedAmount = $derived.by(() => {
		const cents = parseCents(amount);
		if (cents === undefined) return undefined;
		return direction === 'outflow' ? -Math.abs(cents) : Math.abs(cents);
	});
	// An imported Transaction becoming a Transfer may already have its other side imported. Once
	// the pair is linked to that Account there is nothing more to offer.
	const linkAccountId = $derived(
		open &&
			transaction !== undefined &&
			transaction.bankRows.length > 0 &&
			transaction.transfer?.accountId !== transferAccountId
			? transferAccounts.find((account) => account._id === transferAccountId)?._id
			: undefined
	);
	const linkCandidates = useQuery(api.transactions.transferCandidates, () =>
		linkAccountId !== undefined && signedAmount !== undefined && isIsoDate(date)
			? { transferAccountId: linkAccountId, date, amount: signedAmount }
			: 'skip'
	);
	const candidates = $derived(linkAccountId === undefined ? [] : (linkCandidates.data ?? []));
	/**
	 * The imported Transaction to link as the other side, or `LINK_NONE` to create one. Budge picks
	 * the nearest import, so saving doesn't duplicate it; the owner can still pick none.
	 */
	const link: string = $derived(
		linkChoice === LINK_NONE || candidates.some((candidate) => candidate._id === linkChoice)
			? (linkChoice ?? LINK_NONE)
			: (candidates[0]?._id ?? LINK_NONE)
	);

	const getLink = () => link;
	const setLink = (value: string) => {
		linkChoice = value;
	};

	// Fill the form each time the dialog opens, and only then: live updates to the Accounts
	// must not wipe what the owner is typing.
	$effect(() => {
		if (open) untrack(fill);
	});

	function fill() {
		error = '';
		linkChoice = undefined;
		if (transaction) {
			accountId = transaction.accountId;
			date = transaction.date;
			payee = transaction.payeeName ?? '';
			chosenCategoryId = transaction.transfer
				? TRANSFER + transaction.transfer.accountId
				: (transaction.categoryId ?? '');
			direction = transaction.amount < 0 ? 'outflow' : 'inflow';
			amount = formatCents(Math.abs(transaction.amount)).replace('$', '');
			memo = transaction.memo ?? '';
		} else {
			accountId = defaultAccountId ?? accounts.all[0]?._id ?? '';
			date = localIsoDate(new Date());
			payee = '';
			chosenCategoryId = '';
			direction = 'outflow';
			amount = '';
			memo = '';
		}
		filledPayee = payee.trim();
		filledCategoryId = chosenCategoryId;
		categoryPicked = false;
	}

	/** The Category picked, or `undefined` for Uncategorized. */
	function findCategory(id: string): Id<'categories'> | undefined {
		if (id === '') return undefined;
		const list = categories.data;
		if (id === transaction?.categoryId) return transaction.categoryId;
		if (!list) return undefined;
		if (id === list.readyToAssignId) return list.readyToAssignId;
		return list.groups.flatMap((group) => group.categories).find((c) => c._id === id)?._id;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (categoryId === UNRESOLVED) return;
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
		if (transferAccountId === undefined) {
			const category = findCategory(categoryId);
			fields = { ...shared, payee, ...(category === undefined ? {} : { categoryId: category }) };
		} else {
			const other = transferAccounts.find((a) => a._id === transferAccountId);
			if (!other) {
				error = 'Pick another Account to transfer with.';
				return;
			}
			// Saving before the other imports load would create a side that duplicates one of them.
			if (linkCandidates.isLoading) return;
			const linked = candidates.find((candidate) => candidate._id === link);
			// A Transfer has no Payee or Category.
			fields = {
				...shared,
				payee: '',
				transferAccountId: other._id,
				...(linked === undefined ? {} : { transferTransactionId: linked._id })
			};
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
						(value: string) => {
							chosenCategoryId = value;
							categoryPicked = true;
						}
					}
					onchange={() => {
						if (isCardPayment) direction = isCash ? 'outflow' : 'inflow';
					}}
					class="h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm"
				>
					{#if categoryId === UNRESOLVED}
						<option value={UNRESOLVED} disabled>
							{recallFailed ? 'Pick a Category' : 'Looking up the last Category…'}
						</option>
					{/if}
					<option value="">Uncategorized</option>
					{#if categories.data}
						{#if savedCategoryUnlisted && transaction?.categoryId}
							<option value={transaction.categoryId}>{transaction.categoryName}</option>
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
					{:else if transaction?.categoryId}
						<!-- Keeps the saved Category selected while the list loads. -->
						<option value={transaction.categoryId}>{transaction.categoryName}</option>
					{/if}
					{#if transferAccounts.length > 0}
						<optgroup label="Transfer to or from">
							{#each transferAccounts as account (account._id)}
								<option value={TRANSFER + account._id}>Transfer: {account.name}</option>
							{/each}
						</optgroup>
					{/if}
				</select>
				{#if recallFailed}
					<p class="text-sm text-destructive" role="alert">
						Budge couldn't look up this Payee's last Category. Pick one to save.
					</p>
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
			{#if candidates.length > 0}
				<fieldset>
					<legend class="mb-2 text-sm font-medium">Other side</legend>
					<RadioGroup.Root bind:value={getLink, setLink}>
						{#each candidates as candidate (candidate._id)}
							<div class="flex items-center gap-2">
								<RadioGroup.Item value={candidate._id} id={`transfer-link-${candidate._id}`} />
								<Label for={`transfer-link-${candidate._id}`}>
									Link the import {candidate.payeeName ?? ''} on {formatDate(candidate.date)},
									{formatCents(candidate.amount)}
								</Label>
							</div>
						{/each}
						<div class="flex items-center gap-2">
							<RadioGroup.Item value={LINK_NONE} id="transfer-link-new" />
							<Label for="transfer-link-new">Create a new uncleared side</Label>
						</div>
					</RadioGroup.Root>
				</fieldset>
			{/if}
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
				<Button
					type="submit"
					disabled={saving || linkCandidates.isLoading || categoryId === UNRESOLVED}>Save</Button
				>
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
