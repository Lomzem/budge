<script lang="ts">
	import { useAuth, useQuery } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import { Accounts, setAccounts } from '$lib/accounts.svelte';
	import { BankConnections, setBankConnections } from '$lib/bankConnections.svelte';
	import { BudgetMonth, setBudgetMonth } from '$lib/budget.svelte';
	import AccountSidebar from '$lib/components/shell/account-sidebar.svelte';
	import BrandMark from '$lib/components/shell/brand-mark.svelte';
	import SignOutButton from '$lib/components/shell/sign-out-button.svelte';
	import TabBar from '$lib/components/shell/tab-bar.svelte';
	import { setupConvexWithClerk } from '$lib/convex.svelte';
	import { readPublicError } from '$lib/publicError';

	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	setupConvexWithClerk();
	const auth = useAuth();

	const whoami = useQuery(api.owner.whoami, () => (auth.isAuthenticated ? {} : 'skip'));
	const accounts = new Accounts(() => auth.isAuthenticated);
	setAccounts(accounts);
	setBankConnections(new BankConnections(() => accounts.loaded));
	const budget = new BudgetMonth(() => auth.isAuthenticated);
	setBudgetMonth(budget);

	const access = $derived.by(() => {
		if (auth.isLoading) return 'loading';
		if (!auth.isAuthenticated) return 'forbidden';
		if (whoami.error) {
			return readPublicError(whoami.error)?.code === 'FORBIDDEN' ? 'forbidden' : 'failed';
		}
		return whoami.isLoading || !accounts.loaded ? 'loading' : 'owner';
	});
</script>

<svelte:window
	onfocus={() => {
		budget.refreshToday();
	}}
/>

{#if access === 'owner'}
	<a
		href="#main"
		class="sr-only rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
	>
		Skip to content
	</a>
	<div class="flex flex-1">
		<aside class="hidden w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground lg:block">
			<div class="sticky top-0 flex h-svh flex-col">
				<AccountSidebar />
			</div>
		</aside>
		<main
			id="main"
			tabindex="-1"
			class="mx-auto w-full max-w-screen-2xl min-w-0 flex-1 px-4 pt-5 pb-24 outline-none sm:px-6 lg:px-8 lg:pt-8 lg:pb-10"
		>
			{@render children()}
		</main>
	</div>
	<TabBar />
{:else}
	<main class="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
		<BrandMark class="size-12" />
		<h1 class="text-2xl font-bold tracking-tight">Budge</h1>
		<div class="flex min-h-24 flex-col items-center gap-3">
			{#if access === 'loading'}
				<p role="status" class="text-muted-foreground">Loading your budget…</p>
			{:else if access === 'forbidden'}
				<p role="alert">This account can't open Budge.</p>
				<SignOutButton />
			{:else}
				<p role="alert">Budge couldn't reach its server. Try reloading the page.</p>
			{/if}
		</div>
	</main>
{/if}
