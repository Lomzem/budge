<script lang="ts">
	import { useConvexClient, useQuery } from 'convex-svelte';
	import type { FunctionReturnType } from 'convex/server';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getAccounts } from '$lib/accounts.svelte';
	import StartingBalanceStep from '$lib/components/accounts/starting-balance-step.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { DialogSession } from '$lib/dialogSession.svelte';

	type HeldAccount = FunctionReturnType<typeof api.heldAccounts.list>[number];
	type AccountKind = 'cash' | 'creditCard';
	interface MappedAccount {
		_id: Id<'accounts'>;
		kind: AccountKind;
		name: string;
	}
	interface Choice {
		connectionAccountId: Id<'connectionAccounts'>;
		choice: string;
		name: string;
		kind: AccountKind;
	}

	const client = useConvexClient();
	const accounts = getAccounts();
	const held = useQuery(api.heldAccounts.list, () => (accounts.loaded ? {} : 'skip'));
	const dialog = new DialogSession<{
		bankAccount: { _id: Id<'connectionAccounts'>; label: string };
		choice: string;
		name: string;
		kind: AccountKind;
		error: string;
		mapped: MappedAccount | null;
	}>();

	function labelOf(account: HeldAccount) {
		const name = account.name ?? 'An unnamed bank Account';
		return account.mask === null ? name : `${name} ending ${account.mask}`;
	}

	function rowsOf(account: HeldAccount) {
		const count = `${account.rows.toLocaleString()}${account.moreRows ? ' or more' : ''}`;
		return account.rows === 1 && !account.moreRows ? '1 row waiting' : `${count} rows waiting`;
	}

	function open(account: HeldAccount) {
		dialog.open({
			bankAccount: { _id: account._id, label: labelOf(account) },
			choice: '',
			name: account.name ?? '',
			kind: 'cash',
			error: '',
			mapped: null
		});
	}

	async function saveChoice(request: Choice): Promise<MappedAccount | 'ignored' | null> {
		const { connectionAccountId, choice, name, kind } = request;
		if (choice === 'ignore') {
			await client.mutation(api.heldAccounts.ignore, { connectionAccountId });
			return 'ignored';
		}
		if (choice === 'new') {
			const accountId = await client.mutation(api.heldAccounts.createAccount, {
				connectionAccountId,
				name,
				kind
			});
			return { _id: accountId, kind, name };
		}
		const account = accounts.find(choice);
		if (account === undefined) return null;
		const target = { _id: account._id, kind: account.kind, name: account.name };
		await client.mutation(api.heldAccounts.map, { connectionAccountId, accountId: target._id });
		return target;
	}

	async function decide(event: SubmitEvent) {
		event.preventDefault();
		const session = dialog.current;
		if (session === null) return;
		if (session.choice === '') {
			session.error = 'Choose where these rows go.';
			return;
		}
		const request = {
			connectionAccountId: session.bankAccount._id,
			choice: session.choice,
			name: session.name,
			kind: session.kind
		};
		session.error = '';
		const saved = await dialog.run('save', () => saveChoice(request));
		if (!saved.ok) {
			session.error = saved.error?.message ?? "Budge couldn't save that. Try again.";
			return;
		}
		if (saved.value === 'ignored') {
			dialog.close(session);
			return;
		}
		if (saved.value === null) {
			session.error = 'That Account is gone. Choose another Account.';
			return;
		}
		session.mapped = saved.value;
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
	open={dialog.current !== null}
	onOpenChange={(isOpen) => {
		if (!isOpen) dialog.dismiss();
	}}
>
	<Dialog.Content>
		{#if dialog.current !== null}
			{@const session = dialog.current}
			{#key session}
				{#if session.mapped !== null}
					<StartingBalanceStep
						account={session.mapped}
						skippable
						onDone={() => {
							dialog.close(session);
						}}
					/>
				{:else}
					<Dialog.Header>
						<Dialog.Title>{session.bankAccount.label}</Dialog.Title>
						<Dialog.Description>
							Budge doesn't know this bank Account yet, so its rows wait here and aren't imported.
						</Dialog.Description>
					</Dialog.Header>
					<form class="flex flex-col gap-4" onsubmit={decide}>
						<fieldset class="flex flex-col gap-2">
							<legend class="mb-2 text-sm font-medium">Where its rows go</legend>
							<RadioGroup.Root bind:value={session.choice}>
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
						{#if session.choice === 'new'}
							<div class="flex flex-col gap-2">
								<Label for="held-new-name">Name</Label>
								<Input id="held-new-name" bind:value={session.name} required autocomplete="off" />
							</div>
							<fieldset class="flex flex-col gap-2">
								<legend class="mb-2 text-sm font-medium">Type</legend>
								<RadioGroup.Root bind:value={session.kind}>
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
						{:else if session.choice === 'ignore'}
							<p class="text-sm">Its rows are dropped, and Budge won't ask about it again.</p>
						{/if}
						{#if session.error}
							<p role="alert" class="text-sm text-destructive">{session.error}</p>
						{/if}
						<Dialog.Footer>
							<Button type="submit" disabled={dialog.pending('save')}>
								{session.choice === 'ignore' ? 'Ignore' : 'Bring in its rows'}
							</Button>
						</Dialog.Footer>
					</form>
				{/if}
			{/key}
		{/if}
	</Dialog.Content>
</Dialog.Root>
