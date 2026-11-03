<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useMutation, useQuery } from 'convex-svelte';
	import { untrack } from 'svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getAccounts } from '$lib/accounts.svelte';
	import { attempt } from '$lib/attempt';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { formatDate, isIsoDate, localIsoDate } from '$lib/domain/dates';
	import { formatCents, parseCents } from '$lib/domain/money';
	import { SPLIT_LINE_LIMIT } from '$lib/domain/splits';

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

	let accountId = $state('');
	let date = $state('');
	let payee = $state('');

	let chosenCategoryId = $state('');

	let lines: { key: number; categoryId: string; amount: string; memo: string }[] = $state([]);
	let nextLineKey = 0;
	let direction: 'outflow' | 'inflow' = $state('outflow');
	let amount = $state('');
	let memo = $state('');
	let error = $state('');
	let saving = $state(false);
	let confirmDelete = $state(false);
	let confirmBankRemoval = $state<Id<'imports'> | null>(null);
	let unlocked = $state(false);

	const locked = $derived(transaction?.reconciled === true && !unlocked);

	let filledCategoryId = $state('');

	let categoryPicked = $state(false);

	const prefillsCategory = $derived(open && !categoryPicked && filledCategoryId === '');
	const payeeName = $derived(payee.trim());
	const payeeGiven = $derived(payeeName !== '');
	const payeeMemory = useQuery(api.payees.lastCategory, () =>
		prefillsCategory && payeeGiven ? { name: payeeName } : 'skip'
	);
	const recallsCategory = $derived(prefillsCategory && payeeGiven);

	const recallingCategory = $derived(
		recallsCategory &&
			(payeeMemory.isLoading ||
				payeeMemory.isStale ||
				(Boolean(payeeMemory.data) &&
					categories.data === undefined &&
					categories.error === undefined))
	);

	const recallFailed = $derived.by(() => {
		if (!recallsCategory || recallingCategory) return undefined;
		if (payeeMemory.error !== undefined) {
			return "Budge couldn't look up this Payee's last Category. Pick one to save.";
		}
		if (payeeMemory.data && categories.error !== undefined) {
			return "Budge couldn't load the Categories. Pick Uncategorized or a Transfer to save.";
		}
		return undefined;
	});

	const UNRESOLVED = 'unresolved';

	const rememberedCategoryId = $derived.by(() => {
		if (!recallsCategory) return '';
		if (recallingCategory || recallFailed !== undefined) return UNRESOLVED;
		return payeeMemory.data ? (findCategory(payeeMemory.data) ?? '') : '';
	});

	const categoryId = $derived(prefillsCategory ? rememberedCategoryId : chosenCategoryId);

	const TRANSFER = 'transfer:';
	const SPLIT = 'split';
	const isSplit = $derived(categoryId === SPLIT);

	const remainder = $derived.by(() => {
		const total = parseCents(amount);
		if (total === undefined) return undefined;
		let left = Math.abs(total);
		for (const line of lines) {
			const notFilledInYet = line.amount.trim() === '';
			const cents = notFilledInYet ? 0 : parseCents(line.amount);
			if (cents === undefined) return undefined;
			left -= cents;
		}
		return left;
	});

	const blankLine = $derived(lines.some((line) => line.amount.trim() === ''));

	const transferAccountId = $derived(
		categoryId.startsWith(TRANSFER) ? categoryId.slice(TRANSFER.length) : undefined
	);
	const isCash = $derived(accounts.cash.some((account) => account._id === accountId));

	const transferAccounts = $derived(
		isCash ? accounts.all.filter((account) => account._id !== accountId) : accounts.cash
	);
	const isTransfer = $derived(transferAccountId !== undefined);

	const isCardPayment = $derived(
		transferAccountId !== undefined &&
			!(isCash && accounts.cash.some((account) => account._id === transferAccountId))
	);

	const isUnlisted = (id: string | null | undefined) =>
		id !== null &&
		id !== undefined &&
		categories.data !== undefined &&
		id !== categories.data.readyToAssignId &&
		!categories.data.groups.some((group) => group.categories.some((c) => c._id === id));

	const LINK_NONE = 'new';

	let linkChoice: string | undefined = $state();
	const signedAmount = $derived.by(() => {
		const cents = parseCents(amount);
		if (cents === undefined) return undefined;
		return direction === 'outflow' ? -Math.abs(cents) : Math.abs(cents);
	});

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

	const link: string = $derived(
		linkChoice === LINK_NONE || candidates.some((candidate) => candidate._id === linkChoice)
			? (linkChoice ?? LINK_NONE)
			: (candidates[0]?._id ?? LINK_NONE)
	);

	const getLink = () => link;
	const setLink = (value: string) => {
		linkChoice = value;
	};

	let session = 0;

	$effect(() => {
		if (open) untrack(fill);
	});

	let filledFromRow = { date: '', amount: 0 };

	$effect(() => {
		if (!open || transaction === undefined) return;
		const live = { date: transaction.date, amount: transaction.amount };
		untrack(() => {
			refreshUntouched(live);
		});
	});

	function shownAmount(cents: number) {
		return formatCents(Math.abs(cents)).replace('$', '');
	}

	function refreshUntouched(live: { date: string; amount: number }) {
		const before = filledFromRow;
		filledFromRow = live;
		if (date === before.date) date = live.date;
		const amountUntouched =
			amount === shownAmount(before.amount) &&
			direction === (before.amount < 0 ? 'outflow' : 'inflow');
		if (amountUntouched) {
			amount = shownAmount(live.amount);
			direction = live.amount < 0 ? 'outflow' : 'inflow';
		}
	}

	function choiceOf(saved: Row) {
		if (saved.transfer) return TRANSFER + saved.transfer.accountId;
		if (saved.splits) return SPLIT;
		return saved.categoryId ?? '';
	}

	function fill() {
		session += 1;
		error = '';
		unlocked = false;
		linkChoice = undefined;
		if (transaction) {
			accountId = transaction.accountId;
			date = transaction.date;
			payee = transaction.payeeName ?? '';
			chosenCategoryId = choiceOf(transaction);
			direction = transaction.amount < 0 ? 'outflow' : 'inflow';
			amount = shownAmount(transaction.amount);
			memo = transaction.memo ?? '';
			filledFromRow = { date: transaction.date, amount: transaction.amount };
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
			chosenCategoryId = '';
			direction = 'outflow';
			amount = '';
			memo = '';
			lines = [];
		}
		filledCategoryId = chosenCategoryId;
		categoryPicked = false;
	}

	function addLine(lineAmount = '') {
		if (lines.length >= SPLIT_LINE_LIMIT) return;
		lines.push({ key: nextLineKey++, categoryId: '', amount: lineAmount, memo: '' });
	}

	function startSplit(previous: string) {
		lines = [];
		const total = parseCents(amount);
		const sizeAloneSinceTheDirectionIsSetApart =
			total === undefined ? amount : formatCents(Math.abs(total)).replace('$', '');
		addLine(sizeAloneSinceTheDirectionIsSetApart);
		addLine();
		const first = lines[0];
		if (first && previous !== '' && !previous.startsWith(TRANSFER)) first.categoryId = previous;
	}

	function savedCategoryOf(line: { categoryId: string }) {
		const savedLine = transaction?.splits?.find((s) => s.categoryId === line.categoryId);
		if (savedLine) return { id: savedLine.categoryId, name: savedLine.categoryName };
		const seededFromTheParent = transaction?.categoryId === line.categoryId;
		if (seededFromTheParent)
			return { id: line.categoryId, name: transaction.categoryName ?? undefined };
		return undefined;
	}

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

	function readSplits() {
		const splits = [];
		for (const line of lines) {
			const category = findCategory(line.categoryId);
			const cents = parseCents(line.amount);
			if (category === undefined) return 'Pick a Category for each line.';
			if (cents === undefined) return "Enter each line's amount, such as 12.50.";
			const signed = direction === 'outflow' ? -cents : cents;
			splits.push({ categoryId: category, amount: signed, memo: line.memo });
		}
		if (splits.length < 2) return 'A split needs two or more lines.';
		if (remainder !== 0) return 'The lines must add up to the amount.';
		return splits;
	}

	function readTransfer(otherAccountId: string) {
		const other = transferAccounts.find((a) => a._id === otherAccountId);
		if (!other) return 'Pick another Account to transfer with.';
		const savingNowCouldDuplicateAnImportStillLoading = linkCandidates.isLoading;
		if (savingNowCouldDuplicateAnImportStillLoading) return undefined;
		const linked = candidates.find((candidate) => candidate._id === link);
		return {
			transferAccountId: other._id,
			...(linked === undefined ? {} : { transferTransactionId: linked._id })
		};
	}

	async function write(
		work: () => PromiseLike<unknown>,
		failure: string,
		succeeded = () => {
			open = false;
		}
	) {
		const started = session;
		saving = true;
		const result = await attempt(work);
		saving = false;
		if (started !== session) return;
		confirmDelete = false;
		confirmBankRemoval = null;
		if (result.ok) succeeded();
		else error = result.error?.message ?? failure;
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
		if (isSplit) {
			const splits = readSplits();
			if (typeof splits === 'string') {
				error = splits;
				return;
			}
			fields = { ...shared, payee, splits };
		} else if (transferAccountId === undefined) {
			const category = findCategory(categoryId);
			fields = { ...shared, payee, ...(category === undefined ? {} : { categoryId: category }) };
		} else {
			const transfer = readTransfer(transferAccountId);
			if (transfer === undefined) return;
			if (typeof transfer === 'string') {
				error = transfer;
				return;
			}
			const noPayeeOrCategory = { payee: '' };
			fields = { ...shared, ...noPayeeOrCategory, ...transfer };
		}
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
		<option value={savedId}>{savedName}</option>
	{/if}
{/snippet}

{#snippet splitLines()}
	<fieldset class="flex flex-col gap-3 rounded-lg border border-border p-3">
		<legend class="px-1 text-sm font-medium">Split lines</legend>
		<ol class="flex flex-col gap-3">
			{#each lines as line, index (line.key)}
				{@const saved = savedCategoryOf(line)}
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
				disabled={lines.length >= SPLIT_LINE_LIMIT}
				onclick={() => {
					addLine();
				}}>Add line</Button
			>
			<p aria-live="polite" class="text-sm font-medium">
				{#if remainder === undefined}
					Enter amounts such as 12.50 to see what is left.
				{:else if remainder === 0 && blankLine}
					Nothing left for the empty line
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
					bind:value={accountId}
					disabled={locked}
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
				<Input id="transaction-date" type="date" bind:value={date} disabled={locked} required />
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
							if (value === SPLIT) startSplit(categoryId === UNRESOLVED ? '' : categoryId);
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
							{recallFailed === undefined ? 'Looking up the last Category…' : 'Pick a Category'}
						</option>
					{/if}
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
				{#if recallFailed !== undefined}
					<p class="text-sm text-destructive" role="alert">{recallFailed}</p>
				{/if}
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
				<RadioGroup.Root bind:value={direction} disabled={locked}>
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
					disabled={locked}
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
				</section>
			{/if}
			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}
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
