<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { useQuery } from 'convex-svelte';
	import type { FunctionReturnType } from 'convex/server';

	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import * as Table from '$lib/components/ui/table';
	import { formatDate, formatMonth } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';

	type Preview = FunctionReturnType<typeof api.settings.previewLaterCutover>;
	type Folding = Extract<Preview, { kind: 'blocked' | 'ready' }>;
	type Account = Folding['accounts'][number];
	type Row = Account['transactions'][number];
	type MustResolve = Extract<Preview, { kind: 'blocked' }>['mustResolve'][number];
	type Caution = Folding['cautions'][number];

	let {
		from,
		to,
		today,
		error,
		moving,
		onmove,
		onconfirm,
		oncancel
	}: {
		from: string;
		to: string;
		today: string;
		error: string;
		moving: boolean;
		onmove: () => void;
		onconfirm: (fingerprint: string, unlockReconciled: boolean) => void;
		oncancel: () => void;
	} = $props();

	const preview = useQuery(api.settings.previewLaterCutover, () => ({ cutoverDate: to, today }));
	const shown = $derived(preview.data);
	const newDate = $derived(formatDate(to));
	const needsUnlock = $derived(
		shown?.kind === 'ready' &&
			shown.accounts.some(
				(account) =>
					account.startingBalance?.cleared === 'reconciled' ||
					account.transactions.some((row) => row.cleared === 'reconciled')
			)
	);
	let unlocked = $state(false);

	function transactions(count: number) {
		return `${String(count)} ${count === 1 ? 'Transaction' : 'Transactions'}`;
	}

	function balance(account: Pick<Account, 'kind'>, amount: number) {
		if (account.kind !== 'creditCard') return formatCents(amount);
		return amount <= 0 ? `${formatCents(-amount)} owed` : `${formatCents(amount)} in credit`;
	}

	function describe(row: Row) {
		if (row.transferAccountName !== null) return `Transfer with ${row.transferAccountName}`;
		return row.payeeName ?? 'No payee';
	}

	function detailsOf(row: Row) {
		const details: string[] = [];
		if (row.split) details.push('Split');
		else if (row.categoryName !== null) details.push(row.categoryName);
		if (row.fromBank) details.push('From the bank');
		if (row.cleared === 'reconciled') details.push('Reconciled');
		if (row.cleared === 'uncleared') details.push('Uncleared');
		return details.join(', ');
	}

	function basisOf(account: Account) {
		const count = transactions(account.transactions.length);
		if (account.startingBalance === null) return `${count} dated before ${newDate}.`;
		const { amount, date } = account.startingBalance;
		return `Its Starting Balance of ${balance(account, amount)} on ${formatDate(date)}, plus ${count} dated before ${newDate}.`;
	}

	function mustResolveText(item: MustResolve) {
		if (item.kind === 'startingBalanceLater') {
			return `${item.accountName}: its Starting Balance is dated ${formatDate(item.date)}, after ${newDate}. Move the cutover date to ${formatDate(item.date)} or later.`;
		}
		const what = `${item.accountName}: ${formatCents(item.amount)} on ${formatDate(item.date)}`;
		if (item.kind === 'bankChange') {
			return `${what}${item.payeeName === null ? '' : ` (${item.payeeName})`} has a bank change waiting. Accept it or keep yours on the Account page.`;
		}
		if (item.otherDate === null) {
			return `${what} is a Transfer whose other side is missing.`;
		}
		return `${what} is a Transfer whose other side, in ${item.otherAccountName ?? 'another Account'}, is dated ${formatDate(item.otherDate)}. Both sides must fall on the same side of ${newDate}.`;
	}

	function cautionText(caution: Caution) {
		const what = `${transactions(caution.count)} (${formatCents(caution.total)})`;
		const one = caution.count === 1;
		if (caution.kind === 'remapped') {
			return `${caution.accountName}: ${what} came from a bank account that now feeds ${caution.nowAccountName}. ${one ? 'It counts' : 'They count'} in ${caution.accountName}'s Starting Balance, where ${one ? 'it is' : 'they are'} now.`;
		}
		if (caution.kind === 'reconciled') {
			return `${caution.accountName}: ${what} you reconciled ${one ? 'becomes' : 'become'} part of the Starting Balance.`;
		}
		return `${caution.accountName}: ${what} that ${one ? "hasn't" : "haven't"} cleared ${one ? 'counts' : 'count'} in the Starting Balance as if ${one ? 'it' : 'they'} had, so the cleared balance changes by ${formatCents(caution.total)}.`;
	}

	function monthsText(months: readonly string[]) {
		return new Intl.ListFormat('en-US').format(months.map((month) => formatMonth(month)));
	}
</script>

{#snippet nowOnPhone(amount: number)}
	<span class="block text-xs text-muted-foreground tabular-nums @lg:hidden">
		Now {formatCents(amount)}
	</span>
{/snippet}

<Dialog.Header>
	<Dialog.Title>Start on {newDate}?</Dialog.Title>
	<Dialog.Description>
		A preview of moving the cutover date from {formatDate(from)}. Nothing changes until you move it.
	</Dialog.Description>
</Dialog.Header>

{#if preview.error}
	<p role="alert" class="text-destructive">Budge couldn't work out the preview. Try again.</p>
{:else if shown === undefined}
	<p role="status" class="text-muted-foreground">Working it out…</p>
{:else if shown.kind === 'unsupported'}
	<p data-testid="preview-unsupported">{shown.message}</p>
{:else if shown.kind === 'nothingBefore'}
	<p>
		Nothing is dated before {newDate}, so moving the date changes no balance and no Transaction.
	</p>
	{#if to > today}
		<p>
			{newDate} is after today. Bank transactions dated before it, including the coming days, won't be
			brought in.
		</p>
	{/if}
{:else}
	{#if shown.kind === 'blocked'}
		<section
			aria-labelledby="must-resolve-heading"
			class="flex min-w-0 flex-col gap-2 rounded-md border border-destructive/50 p-3"
		>
			<h3 id="must-resolve-heading" class="font-bold">Resolve these first</h3>
			<ul class="flex list-disc flex-col gap-1 pl-5">
				{#each shown.mustResolve as item (item)}
					<li>{mustResolveText(item)}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="balances-heading" class="flex min-w-0 flex-col gap-3">
		<h3 id="balances-heading" class="font-bold">Starting Balances on {newDate}</h3>
		{#each shown.accounts as account (account.accountId)}
			{@const headingId = `preview-account-${account.accountId}`}
			<section aria-labelledby={headingId} class="flex flex-col gap-1 border-t pt-3">
				<div class="flex flex-wrap items-baseline justify-between gap-x-4">
					<h4 id={headingId} class="font-bold">{account.name}</h4>
					<p class="tabular-nums" data-testid="proposed-starting-balance">
						{account.proposedStartingBalance === null
							? 'Not worked out until the above is resolved'
							: balance(account, account.proposedStartingBalance)}
					</p>
				</div>
				<p class="text-muted-foreground">{basisOf(account)}</p>
				{#if account.transactions.length > 0}
					<details class="group rounded-md bg-muted">
						<summary
							class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-3 font-bold [&::-webkit-details-marker]:hidden"
						>
							<ChevronRightIcon
								aria-hidden="true"
								class="size-4 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
							/>
							{transactions(account.transactions.length)} that fold in
						</summary>
						<ul class="flex flex-col px-3 pb-2">
							{#each account.transactions as row (row.transactionId)}
								<li class="flex gap-3 border-t py-2 first:border-t-0">
									<div class="flex min-w-0 flex-1 flex-col">
										<span class="break-words">{describe(row)}</span>
										<span class="text-muted-foreground">
											<time datetime={row.date}>{formatDate(row.date)}</time
											>{#if detailsOf(row) !== ''}, {detailsOf(row)}{/if}
										</span>
									</div>
									<span class="shrink-0 text-right tabular-nums">{formatCents(row.amount)}</span>
								</li>
							{/each}
						</ul>
					</details>
				{/if}
			</section>
		{/each}
	</section>

	{#if shown.kind === 'ready'}
		{@const budget = shown.budget}
		<section aria-labelledby="budget-heading" class="flex min-w-0 flex-col gap-2">
			<h3 id="budget-heading" class="font-bold">{formatMonth(budget.month)} budget</h3>
			<div class="@container">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head width="fill">Available</Table.Head>
							<Table.Head align="end" width="fit" showFrom="lg">Now</Table.Head>
							<Table.Head align="end" width="fit">After</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						<Table.Row>
							<Table.Cell width="fill">
								<span class="block font-bold break-words whitespace-normal">Ready to Assign</span>
								{@render nowOnPhone(budget.readyToAssign.before)}
							</Table.Cell>
							<Table.Cell align="end" numeric showFrom="lg">
								{formatCents(budget.readyToAssign.before)}
							</Table.Cell>
							<Table.Cell align="end" numeric>{formatCents(budget.readyToAssign.after)}</Table.Cell>
						</Table.Row>
						{#each budget.categories as category (category.categoryId)}
							<Table.Row>
								<Table.Cell width="fill">
									<span class="block break-words whitespace-normal">{category.name}</span>
									{@render nowOnPhone(category.before)}
								</Table.Cell>
								<Table.Cell align="end" numeric showFrom="lg"
									>{formatCents(category.before)}</Table.Cell
								>
								<Table.Cell align="end" numeric>{formatCents(category.after)}</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
			<p class="text-muted-foreground">
				{#if budget.removedAssignments.count === 0}
					No Category has money assigned before {formatMonth(budget.month)}.
				{:else}
					The {formatCents(budget.removedAssignments.total)} assigned in {monthsText(
						budget.removedAssignments.months
					)} goes, and {formatMonth(budget.month)} starts with nothing carried over.
				{/if}
			</p>
		</section>
	{/if}

	{#if shown.cautions.length > 0}
		<section aria-labelledby="cautions-heading" class="flex min-w-0 flex-col gap-2">
			<h3 id="cautions-heading" class="font-bold">Worth checking</h3>
			<ul class="flex list-disc flex-col gap-1 pl-5">
				{#each shown.cautions as caution (caution)}
					<li>{cautionText(caution)}</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if shown.kind === 'ready'}
		{#if needsUnlock}
			<div class="flex items-start gap-3 rounded-md border p-3">
				<div class="pt-0.5">
					<Checkbox
						id="unlock-reconciled"
						aria-describedby="unlock-reconciled-detail"
						bind:checked={unlocked}
					/>
				</div>
				<div class="flex min-w-0 flex-col gap-1">
					<Label for="unlock-reconciled">Unlock the Reconciled history</Label>
					<p id="unlock-reconciled-detail" class="text-sm text-muted-foreground">
						Reconciled Transactions and Starting Balances above fold into new Starting Balances,
						which are cleared but not reconciled.
					</p>
				</div>
			</div>
		{/if}
		<p class="text-muted-foreground">Settings offers Undo move until the date moves again.</p>
	{/if}
{/if}

<Dialog.Footer {error}>
	<Button variant="outline" type="button" onclick={oncancel}>Cancel</Button>
	{#if shown?.kind === 'nothingBefore'}
		<Button type="button" disabled={moving} onclick={onmove}>Move start date</Button>
	{:else if shown?.kind === 'ready'}
		{@const fingerprint = shown.fingerprint}
		<Button
			type="button"
			disabled={moving || (needsUnlock && !unlocked)}
			onclick={() => {
				onconfirm(fingerprint, needsUnlock && unlocked);
			}}>Move start date</Button
		>
	{/if}
</Dialog.Footer>
