<script lang="ts">
	import { getAccounts } from '$lib/accounts.svelte';
	import AccountDialog from '$lib/components/accounts/account-dialog.svelte';
	import CutoverDate from '$lib/components/settings/cutover-date.svelte';
	import { Button } from '$lib/components/ui/button';

	const accounts = getAccounts();
	let addOpen = $state(false);
</script>

<svelte:head>
	<title>Budget · Budge</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<h1 class="text-xl font-semibold">Budget</h1>
	<CutoverDate />
	{#if accounts.loaded && accounts.all.length === 0}
		<section class="flex flex-col items-start gap-2">
			<p class="text-muted-foreground">Nothing to budget yet. Add an Account to get started.</p>
			<Button onclick={() => (addOpen = true)}>Add Account</Button>
		</section>
	{/if}
</div>

<AccountDialog bind:open={addOpen} />
