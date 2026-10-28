<script lang="ts">
	import { useAuth, useQuery } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import { Accounts, setAccounts } from '$lib/accounts.svelte';
	import { BudgetMonth, setBudgetMonth } from '$lib/budget.svelte';
	import AccountSidebar from '$lib/components/shell/account-sidebar.svelte';
	import AppMenu from '$lib/components/shell/app-menu.svelte';
	import SignOutButton from '$lib/components/shell/sign-out-button.svelte';
	import ViewMenu from '$lib/components/shell/view-menu.svelte';
	import { setupConvexWithClerk } from '$lib/convex.svelte';
	import { readPublicError } from '$lib/publicError';

	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	setupConvexWithClerk();
	const auth = useAuth();
	// Nothing shows until the backend agrees this is the owner.
	const whoami = useQuery(api.owner.whoami, () => (auth.isAuthenticated ? {} : 'skip'));
	setAccounts(new Accounts(() => auth.isAuthenticated));
	const budget = new BudgetMonth(() => auth.isAuthenticated);
	setBudgetMonth(budget);
	// Income dated today starts counting at midnight, even if Budge stays open and focused.
	$effect(() => {
		const timer = setInterval(() => {
			budget.refreshToday();
		}, 60_000);
		return () => {
			clearInterval(timer);
		};
	});

	const access = $derived.by(() => {
		if (auth.isLoading) return 'loading';
		if (!auth.isAuthenticated) return 'forbidden';
		if (whoami.error) {
			return readPublicError(whoami.error)?.code === 'FORBIDDEN' ? 'forbidden' : 'failed';
		}
		return whoami.isLoading ? 'loading' : 'owner';
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
		class="sr-only rounded-md bg-background px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
	>
		Skip to content
	</a>
	<div class="flex flex-1">
		<aside
			class="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex"
		>
			<AccountSidebar />
		</aside>
		<div class="flex min-w-0 flex-1 flex-col">
			<header class="flex items-center justify-between gap-2 border-b px-3 py-2 lg:hidden">
				<ViewMenu />
				<AppMenu />
			</header>
			<main id="main" tabindex="-1" class="flex-1 p-4 outline-none lg:p-6">
				{@render children()}
			</main>
		</div>
	</div>
{:else}
	<main class="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
		<h1 class="text-2xl font-semibold">Budge</h1>
		{#if access === 'loading'}
			<p role="status" class="text-muted-foreground">Loading…</p>
		{:else if access === 'forbidden'}
			<p role="alert">This account can't open Budge.</p>
			<SignOutButton />
		{:else}
			<p role="alert">Budge couldn't reach its server. Try reloading the page.</p>
		{/if}
	</main>
{/if}
