<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { tick } from 'svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getAccounts } from '$lib/accounts.svelte';
	import { getBankConnections, type HeldAccount } from '$lib/bankConnections.svelte';
	import StartingBalanceStep from '$lib/components/accounts/starting-balance-step.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import type { FocusReturn } from '$lib/focusReturn';

	import { labelOf, waitingNote } from './held';

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

	let {
		onsettled,
		onconfirmed,
		returnFocus
	}: {
		onsettled: (connectionAccountId: Id<'connectionAccounts'>, outcome: string) => void;
		onconfirmed: (account: MappedAccount) => void;
		returnFocus: FocusReturn;
	} = $props();

	const client = useConvexClient();
	const accounts = getAccounts();
	const bank = getBankConnections();
	const fedBy = $derived(
		new Map(
			bank.all.flatMap((connection) =>
				connection.feeds.map((feed) => [feed.accountId, connection.name] as const)
			)
		)
	);
	const kindName = (kind: AccountKind) =>
		kind === 'creditCard' ? 'a credit card' : 'a cash Account';
	const dialog = new DialogSession<{
		bankAccount: {
			_id: Id<'connectionAccounts'>;
			label: string;
			waiting: string;
			kind: AccountKind | null;
		};
		choice: string;
		name: string;
		kind: AccountKind | '';
		error: string;
		mapped: MappedAccount | null;
	}>();

	function sameName(account: HeldAccount) {
		const name = account.name?.trim().toLowerCase();
		if (name === undefined || name === '') return undefined;
		return accounts.all.find((existing) => existing.name.trim().toLowerCase() === name);
	}

	export function open(account: HeldAccount) {
		dialog.open({
			bankAccount: {
				_id: account._id,
				label: labelOf(account),
				waiting: waitingNote(account),
				kind: account.kind
			},
			choice: (account.kind === null ? undefined : sameName(account)?._id) ?? 'new',
			name: account.name ?? '',
			kind: account.kind ?? '',
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

	let details: HTMLElement | null = $state(null);

	async function showDetails() {
		await tick();
		details?.scrollIntoView({ block: 'nearest' });
	}

	function mismatchOf(choice: string, bankKind: AccountKind | null) {
		const target = accounts.find(choice);
		return target !== undefined && bankKind !== null && target.kind !== bankKind;
	}

	async function decide(event: SubmitEvent) {
		event.preventDefault();
		const session = dialog.current;
		if (session === null) return;
		if (session.choice === '') {
			session.error = 'Choose where these transactions go.';
			return;
		}
		if (mismatchOf(session.choice, session.bankAccount.kind)) return;
		if (session.choice === 'new' && session.kind === '') {
			session.error = "Choose this Account's type: cash or credit card.";
			document.getElementById('held-new-cash')?.focus();
			return;
		}
		const request = {
			connectionAccountId: session.bankAccount._id,
			choice: session.choice,
			name: session.name.trim(),
			kind: session.kind === '' ? 'cash' : session.kind
		};
		session.error = '';
		const saved = await dialog.run('save', () => saveChoice(request));
		if (!saved.ok) {
			session.error = saved.error?.message ?? "Budge couldn't save that. Try again.";
			return;
		}
		if (saved.value === 'ignored') {
			onsettled(request.connectionAccountId, 'Ignored');
			dialog.close(session);
			return;
		}
		if (saved.value === null) {
			session.error = 'That Account is gone. Choose another Account.';
			return;
		}
		onsettled(request.connectionAccountId, `Into ${saved.value.name}`);
		session.mapped = saved.value;
	}
</script>

<Dialog.Root
	open={dialog.current !== null}
	onOpenChange={(isOpen) => {
		if (!isOpen) dialog.dismiss();
	}}
>
	<Dialog.Content {returnFocus}>
		{#if dialog.current !== null}
			{@const session = dialog.current}
			{#key session}
				{#if session.mapped !== null}
					<StartingBalanceStep
						account={session.mapped}
						skippable
						onDone={(confirmed) => {
							const account = session.mapped;
							dialog.close(session);
							if (confirmed && account !== null) onconfirmed(account);
						}}
					/>
				{:else}
					{@const target = accounts.find(session.choice)}
					{@const mismatch = mismatchOf(session.choice, session.bankAccount.kind)}
					{@const untyped = session.error !== '' && session.choice === 'new' && session.kind === ''}
					<Dialog.Header>
						<Dialog.Title>{session.bankAccount.label}</Dialog.Title>
						<Dialog.Description>
							{session.bankAccount.waiting}
						</Dialog.Description>
					</Dialog.Header>
					<form class="flex flex-col gap-5" onsubmit={decide}>
						<fieldset class="flex flex-col gap-3">
							<legend class="mb-3 font-bold">Where its transactions go</legend>
							<RadioGroup.Root bind:value={session.choice} onValueChange={showDetails}>
								<div class="flex min-h-9 items-center gap-2.5">
									<RadioGroup.Item value="new" id="held-to-new" />
									<Label for="held-to-new">Into a new Account</Label>
								</div>
								{#each accounts.all as account (account._id)}
									{@const feeder = fedBy.get(account._id)}
									<div class="flex min-h-9 items-center gap-2.5">
										<RadioGroup.Item
											value={account._id}
											id="held-to-{account._id}"
											aria-describedby={feeder === undefined
												? undefined
												: `held-fed-${account._id}`}
										/>
										<div class="flex min-w-0 flex-col">
											<Label for="held-to-{account._id}">Into {account.name}</Label>
											{#if feeder !== undefined}
												<span id="held-fed-{account._id}" class="text-sm text-muted-foreground"
													>Already fed by {feeder}</span
												>
											{/if}
										</div>
									</div>
								{/each}
								<div class="flex min-h-9 items-center gap-2.5">
									<RadioGroup.Item value="ignore" id="held-ignore" />
									<Label for="held-ignore">Nowhere: ignore this bank Account</Label>
								</div>
							</RadioGroup.Root>
						</fieldset>
						<div bind:this={details} class="grid scroll-mb-36">
							<fieldset
								disabled={session.choice !== 'new'}
								inert={session.choice !== 'new'}
								class={[
									'col-start-1 row-start-1 flex flex-col gap-4 rounded-md bg-muted p-4',
									session.choice !== 'new' && 'invisible'
								]}
							>
								<div class="flex flex-col gap-2">
									<Label for="held-new-name">Name</Label>
									<Input id="held-new-name" bind:value={session.name} required autocomplete="off" />
								</div>
								<fieldset class="flex flex-col gap-2">
									<legend class="mb-2 font-bold">Type</legend>
									<RadioGroup.Root
										bind:value={session.kind}
										aria-invalid={untyped || undefined}
										aria-describedby={untyped ? 'held-error' : undefined}
									>
										<div class="flex min-h-9 items-center gap-2.5">
											<RadioGroup.Item value="cash" id="held-new-cash" />
											<Label for="held-new-cash">Cash, such as checking or savings</Label>
										</div>
										<div class="flex min-h-9 items-center gap-2.5">
											<RadioGroup.Item value="creditCard" id="held-new-credit" />
											<Label for="held-new-credit">Credit card</Label>
										</div>
									</RadioGroup.Root>
								</fieldset>
							</fieldset>
							{#if target !== undefined && session.bankAccount.kind !== null && mismatch}
								<p
									id="held-mismatch"
									class="col-start-1 row-start-1 self-start rounded-md bg-warning-tint p-4 text-warning"
								>
									The bank says this is {kindName(session.bankAccount.kind)}, but {target.name} is {kindName(
										target.kind
									)}, so its balance would count the wrong way. Choose a matching Account or a new
									one.
								</p>
							{:else if target !== undefined}
								<p class="col-start-1 row-start-1 self-start rounded-md bg-muted p-4">
									{#if session.bankAccount.kind === null}
										The bank didn't say what kind of account this is, so make sure it is {kindName(
											target.kind
										)} like {target.name}.
									{/if}
									Its transactions join {target.name}. Next, you check {target.name}'s Starting
									Balance.
								</p>
							{:else if session.choice === 'ignore'}
								<p class="col-start-1 row-start-1 self-start rounded-md bg-muted p-4">
									Its transactions are dropped, and Budge stops asking. Bring it back from its Bank
									card any time.
								</p>
							{/if}
						</div>
						<Dialog.Footer error={session.error} errorId="held-error">
							<div class="grid min-w-40">
								<Button
									type="submit"
									disabled={dialog.pending('save')}
									aria-disabled={mismatch}
									aria-describedby={mismatch ? 'held-mismatch' : undefined}
								>
									{session.choice === 'ignore' ? 'Ignore' : 'Import its transactions'}
								</Button>
							</div>
						</Dialog.Footer>
					</form>
				{/if}
			{/key}
		{/if}
	</Dialog.Content>
</Dialog.Root>
