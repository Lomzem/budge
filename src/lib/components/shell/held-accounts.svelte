<script lang="ts">
	import { useConvexClient, useQuery } from 'convex-svelte';
	import type { FunctionReturnType } from 'convex/server';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getAccounts } from '$lib/accounts.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { parseCents } from '$lib/domain/money';
	import { attempt } from '$lib/attempt';

	type HeldAccount = FunctionReturnType<typeof api.heldAccounts.list>[number];

	const client = useConvexClient();
	const accounts = getAccounts();
	const held = useQuery(api.heldAccounts.list, () => (accounts.loaded ? {} : 'skip'));

	let chosen = $state<{ _id: Id<'connectionAccounts'>; label: string } | null>(null);
	let step = $state<'choose' | 'balance'>('choose');
	let choice = $state('');
	let name = $state('');
	let kind: 'cash' | 'creditCard' = $state('cash');
	let error = $state('');
	let saving = $state(false);

	let mapped = $state<{ _id: Id<'accounts'>; kind: 'cash' | 'creditCard' } | null>(null);
	let suggesting = $state(false);
	let suggestion = $state('');
	let balance = $state('');

	function labelOf(account: HeldAccount) {
		const name = account.name ?? 'An unnamed bank Account';
		return account.mask === null ? name : `${name} ending ${account.mask}`;
	}

	function rowsOf(account: HeldAccount) {
		const count = `${account.rows.toLocaleString()}${account.moreRows ? ' or more' : ''}`;
		return account.rows === 1 && !account.moreRows ? '1 row waiting' : `${count} rows waiting`;
	}

	function open(account: HeldAccount) {
		chosen = { _id: account._id, label: labelOf(account) };
		step = 'choose';
		choice = '';
		name = account.name ?? '';
		kind = 'cash';
		error = '';
		mapped = null;
	}

	function close() {
		chosen = null;
	}

	function typed(cents: number) {
		return `${cents < 0 ? '-' : ''}${(Math.abs(cents) / 100).toFixed(2)}`;
	}

	async function suggest() {
		if (mapped === null) return;
		const { _id: accountId, kind: mappedKind } = mapped;
		suggesting = true;
		suggestion = '';
		const asked = await attempt(() =>
			client.action(api.heldAccounts.suggestStartingBalance, { accountId })
		);
		suggesting = false;
		if (!asked.ok) {
			suggestion =
				asked.error?.message ??
				"Budge couldn't ask the bank for a balance. Enter the starting balance.";
			return;
		}
		const outcome = asked.value;
		if (outcome.kind === 'suggested') {
			const shown =
				mappedKind === 'creditCard' ? -outcome.startingBalance : outcome.startingBalance;
			balance = typed(shown);
			suggestion =
				"Budge suggests this from the bank's current balance, less the Transactions imported since the cutover date.";
		} else if (outcome.kind === 'importing') {
			suggestion =
				"Budge is still bringing in this Account's rows. Suggest again in a moment, or enter the starting balance.";
		} else {
			suggestion = "The bank didn't report a balance for this Account. Enter the starting balance.";
		}
	}

	async function saveChoice(connectionAccountId: Id<'connectionAccounts'>) {
		if (choice === 'ignore') {
			await client.mutation(api.heldAccounts.ignore, { connectionAccountId });
			return 'ignored' as const;
		}
		if (choice === 'new') {
			const accountId = await client.mutation(api.heldAccounts.createAccount, {
				connectionAccountId,
				name,
				kind
			});
			return { _id: accountId, kind };
		}
		const account = accounts.all.find((candidate) => candidate._id === choice);
		if (account === undefined) return null;
		await client.mutation(api.heldAccounts.map, { connectionAccountId, accountId: account._id });
		return { _id: account._id, kind: account.kind };
	}

	async function decide(event: SubmitEvent) {
		event.preventDefault();
		if (chosen === null) return;
		const connectionAccountId = chosen._id;
		if (choice === '') {
			error = 'Choose where these rows go.';
			return;
		}
		saving = true;
		error = '';
		const saved = await attempt(() => saveChoice(connectionAccountId));
		saving = false;
		if (!saved.ok) {
			error = saved.error?.message ?? "Budge couldn't save that. Try again.";
			return;
		}
		if (saved.value === 'ignored') {
			close();
			return;
		}
		if (saved.value === null) return;
		mapped = saved.value;
		step = 'balance';
		balance = '';
		void suggest();
	}

	async function confirmBalance(event: SubmitEvent) {
		event.preventDefault();
		if (mapped === null) return;
		const cents = parseCents(balance);
		if (cents === undefined) {
			error = 'Enter the balance as an amount, such as 1,250.00.';
			return;
		}
		const accountId = mapped._id;
		const startingBalance = mapped.kind === 'creditCard' ? -cents : cents;
		saving = true;
		error = '';
		const saved = await attempt(() =>
			client.mutation(api.accounts.setStartingBalance, { accountId, startingBalance })
		);
		saving = false;
		if (!saved.ok) {
			error = saved.error?.message ?? "Budge couldn't save the starting balance. Try again.";
			return;
		}
		close();
	}
</script>

{#if held.data !== undefined && held.data.length > 0}
	<section aria-labelledby="held-accounts" class="flex flex-col gap-0.5 text-xs">
		<h2 id="held-accounts" class="px-2 font-medium">New bank Accounts</h2>
		<ul class="flex flex-col gap-0.5 text-muted-foreground">
			{#each held.data as account (account._id)}
				<li>
					<button
						class="w-full rounded-md px-2 py-1 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
						onclick={() => {
							open(account);
						}}
					>
						{labelOf(account)}, from {account.connectionName}: {rowsOf(account)}
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<Dialog.Root
	open={chosen !== null}
	onOpenChange={(isOpen) => {
		if (!isOpen) close();
	}}
>
	<Dialog.Content>
		{#if chosen !== null && step === 'choose'}
			<Dialog.Header>
				<Dialog.Title>{chosen.label}</Dialog.Title>
				<Dialog.Description>
					Budge doesn't know this bank Account yet, so its rows wait here and aren't imported.
				</Dialog.Description>
			</Dialog.Header>
			<form class="flex flex-col gap-4" onsubmit={decide}>
				<fieldset class="flex flex-col gap-2">
					<legend class="mb-2 text-sm font-medium">Where its rows go</legend>
					<RadioGroup.Root bind:value={choice}>
						{#each accounts.all as account (account._id)}
							<div class="flex items-center gap-2">
								<RadioGroup.Item value={account._id} id="held-to-{account._id}" />
								<Label for="held-to-{account._id}">Into {account.name}</Label>
							</div>
						{/each}
						<div class="flex items-center gap-2">
							<RadioGroup.Item value="new" id="held-to-new" />
							<Label for="held-to-new">Into a new Account</Label>
						</div>
						<div class="flex items-center gap-2">
							<RadioGroup.Item value="ignore" id="held-ignore" />
							<Label for="held-ignore">Nowhere: ignore this bank Account</Label>
						</div>
					</RadioGroup.Root>
				</fieldset>
				{#if choice === 'new'}
					<div class="flex flex-col gap-2">
						<Label for="held-new-name">Name</Label>
						<Input id="held-new-name" bind:value={name} required autocomplete="off" />
					</div>
					<fieldset class="flex flex-col gap-2">
						<legend class="mb-2 text-sm font-medium">Type</legend>
						<RadioGroup.Root bind:value={kind}>
							<div class="flex items-center gap-2">
								<RadioGroup.Item value="cash" id="held-new-cash" />
								<Label for="held-new-cash">Cash, such as checking or savings</Label>
							</div>
							<div class="flex items-center gap-2">
								<RadioGroup.Item value="creditCard" id="held-new-credit" />
								<Label for="held-new-credit">Credit card</Label>
							</div>
						</RadioGroup.Root>
					</fieldset>
				{:else if choice === 'ignore'}
					<p class="text-sm">Its rows are dropped, and Budge won't ask about it again.</p>
				{/if}
				{#if error}
					<p role="alert" class="text-sm text-destructive">{error}</p>
				{/if}
				<Dialog.Footer>
					<Button type="submit" disabled={saving}>
						{choice === 'ignore' ? 'Ignore' : 'Bring in its rows'}
					</Button>
				</Dialog.Footer>
			</form>
		{:else if chosen !== null && mapped !== null}
			<Dialog.Header>
				<Dialog.Title>Starting balance</Dialog.Title>
				<Dialog.Description>
					The starting balance is recorded on the cutover date. Confirm or correct it.
				</Dialog.Description>
			</Dialog.Header>
			<form class="flex flex-col gap-4" onsubmit={confirmBalance}>
				<div class="flex flex-col gap-2">
					<Label for="held-balance">
						{mapped.kind === 'creditCard' ? 'Amount owed on the cutover date' : 'Starting balance'}
					</Label>
					<Input
						id="held-balance"
						bind:value={balance}
						inputmode="decimal"
						placeholder={suggesting ? 'Asking the bank…' : '0.00'}
						autocomplete="off"
						required
					/>
				</div>
				<p role="status" class="text-sm text-muted-foreground">{suggestion}</p>
				{#if error}
					<p role="alert" class="text-sm text-destructive">{error}</p>
				{/if}
				<Dialog.Footer>
					<Button variant="outline" type="button" disabled={suggesting} onclick={suggest}>
						Suggest again
					</Button>
					<Button variant="outline" type="button" onclick={close}>Skip</Button>
					<Button type="submit" disabled={saving}>Confirm</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
