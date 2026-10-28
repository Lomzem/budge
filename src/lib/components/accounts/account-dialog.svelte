<script lang="ts">
	import { useMutation, useQuery } from 'convex-svelte';

	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { formatDate } from '$lib/domain/dates';
	import { parseCents } from '$lib/domain/money';
	import { readPublicError } from '$lib/publicError';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const settings = useQuery(api.settings.get, {});
	const createAccount = useMutation(api.accounts.create);

	let name = $state('');
	let kind: 'cash' | 'creditCard' = $state('cash');
	let balance = $state('');
	let error = $state('');
	let saving = $state(false);

	const cutoverDate = $derived(settings.data?.cutoverDate);

	$effect(() => {
		if (open) {
			name = '';
			kind = 'cash';
			balance = '';
			error = '';
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const cents = balance.trim() === '' ? 0 : parseCents(balance);
		if (cents === undefined) {
			error = 'Enter the balance as an amount, such as 1,250.00.';
			return;
		}
		saving = true;
		try {
			// A card's balance is what is owed, kept as a negative balance.
			const startingBalance = kind === 'creditCard' ? -cents : cents;
			const accountId = await createAccount({ name, kind, startingBalance });
			open = false;
			await goto(resolve('/(app)/accounts/[accountId]', { accountId }));
		} catch (thrown) {
			error = readPublicError(thrown)?.message ?? "Budge couldn't add the Account. Try again.";
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add Account</Dialog.Title>
			{#if cutoverDate}
				<Dialog.Description>
					The starting balance is recorded on the cutover date, {formatDate(cutoverDate)}.
				</Dialog.Description>
			{/if}
		</Dialog.Header>
		{#if cutoverDate === null}
			<p class="text-sm">
				Set the cutover date first, on the
				<a href={resolve('/')} class="underline" onclick={() => (open = false)}>Budget</a> screen.
			</p>
		{:else}
			<form class="flex flex-col gap-4" onsubmit={submit}>
				<div class="flex flex-col gap-2">
					<Label for="account-name">Name</Label>
					<Input id="account-name" bind:value={name} required autocomplete="off" />
				</div>
				<fieldset class="flex flex-col gap-2">
					<legend class="mb-2 text-sm font-medium">Type</legend>
					<RadioGroup.Root bind:value={kind}>
						<div class="flex items-center gap-2">
							<RadioGroup.Item value="cash" id="account-kind-cash" />
							<Label for="account-kind-cash">Cash, such as checking or savings</Label>
						</div>
						<div class="flex items-center gap-2">
							<RadioGroup.Item value="creditCard" id="account-kind-credit" />
							<Label for="account-kind-credit">Credit card</Label>
						</div>
					</RadioGroup.Root>
				</fieldset>
				<div class="flex flex-col gap-2">
					<Label for="account-balance">
						{kind === 'creditCard' ? 'Amount owed' : 'Current balance'}
					</Label>
					<Input
						id="account-balance"
						bind:value={balance}
						inputmode="decimal"
						placeholder="0.00"
						autocomplete="off"
					/>
				</div>
				{#if error}
					<p role="alert" class="text-sm text-destructive">{error}</p>
				{/if}
				<Dialog.Footer>
					<Button type="submit" disabled={saving}>Add Account</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
