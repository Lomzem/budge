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
	const categories = useQuery(api.categories.list, () => (open ? {} : 'skip'));

	let accountId = $state('');
	let date = $state('');
	let payee = $state('');
	/** A Category ID, or `''` for Uncategorized. */
	let categoryId = $state('');
	let direction: 'outflow' | 'inflow' = $state('outflow');
	let amount = $state('');
	let memo = $state('');
	let error = $state('');
	let saving = $state(false);
	let confirmDelete = $state(false);

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
			categoryId = transaction.categoryId ?? '';
			direction = transaction.amount < 0 ? 'outflow' : 'inflow';
			amount = formatCents(Math.abs(transaction.amount)).replace('$', '');
			memo = transaction.memo ?? '';
		} else {
			accountId = defaultAccountId ?? accounts.all[0]?._id ?? '';
			date = localIsoDate(new Date());
			payee = '';
			categoryId = '';
			direction = 'outflow';
			amount = '';
			memo = '';
		}
	}

	/** The Category picked, or `undefined` for Uncategorized. */
	function findCategory(id: string): Id<'categories'> | undefined {
		if (id === '') return undefined;
		const list = categories.data;
		if (!list) return id === transaction?.categoryId ? transaction.categoryId : undefined;
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
		const category = findCategory(categoryId);
		const fields = {
			accountId: account._id,
			date,
			amount: direction === 'outflow' ? -Math.abs(cents) : Math.abs(cents),
			payee,
			...(category === undefined ? {} : { categoryId: category }),
			memo
		};
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
			<div class="flex flex-col gap-2">
				<Label for="transaction-payee">Payee</Label>
				<Input id="transaction-payee" bind:value={payee} autocomplete="off" />
			</div>
			<div class="flex flex-col gap-2">
				<Label for="transaction-category">Category</Label>
				<select
					id="transaction-category"
					bind:value={categoryId}
					class="h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm"
				>
					<option value="">Uncategorized</option>
					{#if categories.data}
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
				</select>
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
				<Button type="submit" disabled={saving}>Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={confirmDelete}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete this Transaction?</AlertDialog.Title>
			<AlertDialog.Description>
				Its amount comes out of the Account balance. This can't be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep it</AlertDialog.Cancel>
			<AlertDialog.Action onclick={deleteTransaction} disabled={saving}>Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
