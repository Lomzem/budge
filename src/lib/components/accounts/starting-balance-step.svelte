<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import type { FunctionReturnType } from 'convex/server';
	import { onMount } from 'svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { getBankConnections } from '$lib/bankConnections.svelte';
	import { labelOf } from '$lib/components/bank/held';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import { formatDate } from '$lib/domain/dates';
	import { formatCents, parseCents } from '$lib/domain/money';

	type Imported = FunctionReturnType<typeof api.heldAccounts.startingBalanceEvidence>['imported'];

	let {
		account,
		skippable = false,
		onDone
	}: {
		account: { _id: Id<'accounts'>; kind: 'cash' | 'creditCard'; name: string };
		skippable?: boolean;
		onDone: (confirmed: boolean) => void;
	} = $props();

	const client = useConvexClient();
	const bank = getBankConnections();
	const current = useQuery(api.accounts.startingBalance, () => ({ accountId: account._id }));
	const evidence = useQuery(api.heldAccounts.startingBalanceEvidence, () => ({
		accountId: account._id
	}));
	const owed = $derived(account.kind === 'creditCard');
	const since = $derived(evidence.data === undefined ? null : formatDate(evidence.data.since));
	const feed = $derived(
		bank.all
			.flatMap((connection) =>
				connection.feeds.map((one) => ({ ...one, connectionName: connection.name }))
			)
			.find((one) => one.accountId === account._id)
	);

	const step = new DialogSession<object, 'suggest' | 'confirm'>();
	const suggesting = $derived(step.pending('suggest'));
	const saving = $derived(step.pending('confirm'));
	let balance = $state('');
	let synced = $state(true);
	let suggestion = $state('');
	let error = $state('');
	let asked = $state<{ bankBalance: number; imported: Imported } | null>(null);
	let unasked = $state('Asking the bank…');
	const imported = $derived(asked?.imported ?? evidence.data?.imported);

	onMount(() => {
		step.open({});
		void suggest();
		return () => {
			step.dismiss();
		};
	});

	function typed(cents: number) {
		return `${cents < 0 ? '-' : ''}${(Math.abs(cents) / 100).toFixed(2)}`;
	}

	function shown(startingBalance: number) {
		return owed ? -startingBalance : startingBalance;
	}

	function transactions(count: number) {
		return count === 1 ? '1 Transaction' : `${count.toLocaleString()} Transactions`;
	}

	function dated({ first, last }: Imported) {
		if (first === null || last === null) return '';
		return first === last
			? `, dated ${formatDate(first)}`
			: `, dated ${formatDate(first)} to ${formatDate(last)}`;
	}

	async function suggest() {
		const accountId = account._id;
		const typedBefore = balance;
		suggestion = '';
		asked = null;
		unasked = 'Asking the bank…';
		const answer = await step.run('suggest', () =>
			client.action(api.heldAccounts.suggestStartingBalance, { accountId })
		);
		if (!answer.ok) {
			const reason = answer.error?.message ?? "Budge couldn't ask the bank for a balance.";
			unasked = `Unknown. ${reason}`;
			suggestion = `${reason} Enter the starting balance.`;
			return;
		}
		const outcome = answer.value;
		if (outcome.kind === 'suggested') {
			asked = { bankBalance: outcome.bankBalance, imported: outcome.imported };
			const amount = typed(shown(outcome.startingBalance));
			const basis =
				'This is an estimate: open What it’s based on, and check it before you confirm.';
			if (balance === typedBefore) {
				balance = amount;
				suggestion = `Budge filled in an estimate. ${basis}`;
			} else {
				suggestion = `Budge estimates ${amount}. Your entry stays. ${basis}`;
			}
		} else if (outcome.kind === 'importing') {
			unasked = 'Not asked yet: Budge is still bringing in rows.';
			suggestion =
				"Budge is still bringing in this Account's rows. Suggest again in a moment, or enter the starting balance.";
		} else if (outcome.kind === 'noBalance') {
			unasked = "Unknown. The bank didn't report one.";
			suggestion = "The bank didn't report a balance for this Account. Enter the starting balance.";
		} else {
			synced = false;
		}
	}

	async function confirm(event: SubmitEvent) {
		event.preventDefault();
		const cents = parseCents(balance);
		if (cents === undefined) {
			error = 'Enter the balance as an amount, such as 1,250.00.';
			return;
		}
		const accountId = account._id;
		const startingBalance = owed ? -cents : cents;
		error = '';
		const saved = await step.run('confirm', () =>
			client.mutation(api.accounts.setStartingBalance, { accountId, startingBalance })
		);
		if (!saved.ok) {
			error = saved.error?.message ?? "Budge couldn't save the starting balance. Try again.";
			return;
		}
		onDone(true);
	}
</script>

<Dialog.Header>
	<Dialog.Title>Starting balance for {account.name}</Dialog.Title>
	<Dialog.Description>
		Budge records it on {since ?? 'the cutover date'}{since === null ? '' : ', the cutover date'}.
		Confirm or correct it.
		{#if skippable}
			You can change it later from the Account's actions.
		{/if}
	</Dialog.Description>
</Dialog.Header>
<form class="flex flex-col gap-4" onsubmit={confirm}>
	<div class="flex flex-col gap-2">
		<Label for="starting-balance">
			{owed ? `Amount owed on ${since ?? 'the cutover date'}` : 'Starting balance'}
		</Label>
		<Input
			id="starting-balance"
			bind:value={balance}
			inputmode="decimal"
			placeholder={suggesting && synced ? 'Asking the bank…' : '0.00'}
			autocomplete="off"
			required
		/>
		{#if current.data != null}
			<p class="text-sm text-muted-foreground tabular-nums" data-testid="current-starting-balance">
				Now {formatCents(shown(current.data))}{owed ? ' owed' : ''}
			</p>
		{/if}
	</div>
	<p role="status" class="text-sm text-muted-foreground">{suggestion}</p>
	{#if feed !== undefined && imported !== undefined && since !== null}
		<details class="group rounded-md bg-muted text-sm">
			<summary
				class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-3 font-bold [&::-webkit-details-marker]:hidden"
			>
				<ChevronRightIcon
					aria-hidden="true"
					class="size-4 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
				/>
				What it’s based on
			</summary>
			<div class="flex flex-col gap-3 px-3 pb-3">
				<dl class="flex flex-col gap-2">
					<div>
						<dt class="text-muted-foreground">Bank Account</dt>
						<dd>{labelOf({ name: feed.bankName, mask: feed.mask })} at {feed.connectionName}</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">
							{owed ? 'Owed now, says the bank' : 'Balance now, says the bank'}
						</dt>
						<dd class="tabular-nums" data-testid="bank-balance">
							{asked === null ? unasked : formatCents(shown(asked.bankBalance))}
						</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">When the bank measured it</dt>
						<dd>Unknown. The bank doesn't say.</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Imported since {since}</dt>
						<dd data-testid="imported-since">
							{imported.count === 0 ? 'None' : `${transactions(imported.count)}${dated(imported)}`}
						</dd>
					</div>
					{#if imported.count > 0}
						<div>
							<dt class="text-muted-foreground">
								{owed ? 'Their net change in what you owe' : 'Their net amount'}
							</dt>
							<dd class="tabular-nums">{formatCents(shown(imported.total))}</dd>
						</div>
					{/if}
					<div>
						<dt class="text-muted-foreground">Every Transaction since {since} arrived?</dt>
						<dd>Unknown. The bank doesn't say whether its history is complete.</dd>
					</div>
				</dl>
				<p>
					Budge's estimate is the bank's balance less the imported Transactions, so a missing
					Transaction or an out-of-date balance makes it wrong. A working connection doesn't prove
					it either. Compare it with your bank statement balance for the start of {since}.
				</p>
			</div>
		</details>
	{/if}
	<Dialog.Footer {error}>
		{#if synced}
			<Button variant="outline" type="button" disabled={suggesting} onclick={suggest}>
				Suggest again
			</Button>
		{/if}
		<Button
			variant="outline"
			type="button"
			onclick={() => {
				onDone(false);
			}}
		>
			{skippable ? 'Skip' : 'Cancel'}
		</Button>
		<Button type="submit" disabled={saving}>Confirm</Button>
	</Dialog.Footer>
</form>
