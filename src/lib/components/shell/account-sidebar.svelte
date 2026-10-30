<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { useQuery } from 'convex-svelte';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import { getAccounts, type Account } from '$lib/accounts.svelte';
	import AccountDialog from '$lib/components/accounts/account-dialog.svelte';
	import { formatCents } from '$lib/domain/money';
	import { formatUnapprovedCount } from '$lib/domain/unapproved';
	import { VIEWS } from '$lib/views';

	import AppMenu from './app-menu.svelte';

	const accounts = getAccounts();
	const unapproved = useQuery(api.transactions.unapprovedCount, () =>
		accounts.loaded ? {} : 'skip'
	);
	let addOpen = $state(false);

	const total = (list: Account[]) => list.reduce((sum, account) => sum + account.balance, 0);
	const linkClass =
		'flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground';
</script>

<nav aria-label="Budget and Accounts" class="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
	<p class="px-2 text-lg font-semibold">Budge</p>
	<ul class="flex flex-col gap-0.5 text-sm">
		{#each VIEWS as view (view.href)}
			<li>
				<a
					href={resolve(view.href)}
					aria-current={view.href === page.url.pathname ? 'page' : undefined}
					class={linkClass}
				>
					{view.label}
					{#if view.href === '/accounts' && (unapproved.data ?? 0) > 0}
						<span class="shrink-0 text-xs tabular-nums">
							{formatUnapprovedCount(unapproved.data ?? 0)} Unapproved
						</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
	{#each accounts.groups as group (group.label)}
		<section aria-labelledby="sidebar-{group.label}" class="flex flex-col gap-1 text-sm">
			<h2
				id="sidebar-{group.label}"
				class="flex items-baseline justify-between gap-2 px-2 text-xs font-medium text-muted-foreground"
			>
				{group.label}
				<span class="tabular-nums">{formatCents(total(group.accounts))}</span>
			</h2>
			<ul class="flex flex-col gap-0.5">
				{#each group.accounts as account (account._id)}
					{@const href = resolve('/(app)/accounts/[accountId]', { accountId: account._id })}
					<li>
						<a
							{href}
							aria-current={href === page.url.pathname ? 'page' : undefined}
							class={linkClass}
						>
							<span class="truncate">{account.name}</span>
							<span class="shrink-0 tabular-nums">{formatCents(account.balance)}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
	<button
		class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
		onclick={() => (addOpen = true)}
	>
		<PlusIcon aria-hidden="true" class="size-4" />
		Add Account
	</button>
</nav>
<div class="border-t border-sidebar-border p-3">
	<AppMenu wide />
</div>

<AccountDialog bind:open={addOpen} />
