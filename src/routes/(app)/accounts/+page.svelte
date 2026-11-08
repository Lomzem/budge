<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Result } from 'effect';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getAccounts, type Account } from '$lib/accounts.svelte';
	import AccountDialog from '$lib/components/accounts/account-dialog.svelte';
	import TransactionTable from '$lib/components/transactions/transaction-table.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatCents } from '$lib/domain/money';

	const accounts = getAccounts();
	const sum = (list: Account[]) => list.reduce((total, account) => total + account.balance, 0);
	const total = $derived(sum(accounts.all));
	let addOpen = $state(false);
	const LIST_KEY = 'budge.accountListOpen';

	function rememberedOpen() {
		const stored = Result.try(() => localStorage.getItem(LIST_KEY));
		return Result.isSuccess(stored) && stored.success === 'true';
	}

	function remember(event: Event) {
		const open = (event.currentTarget as HTMLDetailsElement).open;
		Result.try(() => {
			localStorage.setItem(LIST_KEY, String(open));
		});
	}

	const listOpenOnArrival = page.url.search === '' && rememberedOpen();
</script>

<svelte:head>
	<title>Accounts · Budge</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-2xl font-bold tracking-tight">Accounts</h1>
			<p class="text-muted-foreground">
				Net balance
				<span class={['font-bold text-foreground', total < 0 && 'text-destructive']}>
					{formatCents(total)}
				</span>
			</p>
		</div>
		<Button variant="outline" onclick={() => (addOpen = true)}>
			<PlusIcon aria-hidden="true" />
			Add Account
		</Button>
	</header>

	{#if accounts.all.length === 0}
		<section
			class="flex max-w-2xl flex-col items-start gap-2 rounded-lg border border-dashed border-input p-6"
		>
			<p class="font-bold">No Accounts yet</p>
			<p class="text-muted-foreground">
				Add an Account with its current balance, or connect a bank from the <a
					href={resolve('/bank')}
					class="underline underline-offset-4 hover:no-underline">Bank</a
				> page.
			</p>
		</section>
	{:else}
		<details class="group lg:hidden" open={listOpenOnArrival} ontoggle={remember}>
			<summary
				class="-mx-1 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-1 font-bold [&::-webkit-details-marker]:hidden"
			>
				<ChevronRightIcon
					aria-hidden="true"
					class="size-4 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
				/>
				Your Accounts
				<span class="font-normal text-muted-foreground">{accounts.all.length}</span>
			</summary>
			<nav aria-label="Accounts" class="flex flex-col gap-4 pt-2">
				{#each accounts.groups as group (group.label)}
					<section aria-labelledby="list-{group.label}" class="flex flex-col gap-2">
						<h2
							id="list-{group.label}"
							class="flex items-baseline justify-between gap-2 px-1 text-sm font-bold text-muted-foreground"
						>
							{group.label}
							<span>{formatCents(sum(group.accounts))}</span>
						</h2>
						<ul class="flex flex-col divide-y rounded-lg border bg-card">
							{#each group.accounts as account (account._id)}
								<li>
									<a
										href={resolve('/(app)/accounts/[accountId]', { accountId: account._id })}
										class="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-accent"
									>
										<span class="flex-1 truncate font-bold">{account.name}</span>
										<span class={['shrink-0', account.balance < 0 && 'text-destructive']}>
											{formatCents(account.balance)}
										</span>
										<ChevronRightIcon aria-hidden="true" class="size-4 text-muted-foreground" />
									</a>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</nav>
		</details>
		<section aria-labelledby="all-transactions" class="flex flex-col gap-3">
			<h2 id="all-transactions" class="text-lg font-bold">All Transactions</h2>
			<TransactionTable />
		</section>
	{/if}
</div>

<AccountDialog bind:open={addOpen} />
