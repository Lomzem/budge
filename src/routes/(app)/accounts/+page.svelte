<script lang="ts">
	import { getAccounts } from '$lib/accounts.svelte';
	import TransactionTable from '$lib/components/transactions/transaction-table.svelte';
	import { formatCents } from '$lib/domain/money';

	const accounts = getAccounts();
	const total = $derived(accounts.all.reduce((sum, account) => sum + account.balance, 0));
</script>

<svelte:head>
	<title>All Accounts · Budge</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<header class="flex flex-wrap items-baseline justify-between gap-2">
		<h1 class="text-xl font-semibold">All Accounts</h1>
		{#if accounts.loaded}
			<p class="tabular-nums">
				<span class="text-muted-foreground">Balance</span>
				{formatCents(total)}
			</p>
		{/if}
	</header>
	{#if accounts.loaded && accounts.all.length === 0}
		<p class="text-muted-foreground">No Accounts yet.</p>
	{:else}
		<TransactionTable />
	{/if}
</div>
