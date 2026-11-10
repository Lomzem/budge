<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { useQuery } from 'convex-svelte';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import { getAccounts, type Account } from '$lib/accounts.svelte';
	import { getBankConnections } from '$lib/bankConnections.svelte';
	import AccountDialog from '$lib/components/accounts/account-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatCents } from '$lib/domain/money';
	import { formatUnapprovedCount } from '$lib/domain/unapproved';
	import { SECTIONS } from '$lib/views';

	import BrandMark from './brand-mark.svelte';
	import SectionBadge from './section-badge.svelte';

	const accounts = getAccounts();
	const bank = getBankConnections();
	let { ready }: { ready: boolean } = $props();

	const unapproved = useQuery(api.transactions.unapprovedCount, () => (ready ? {} : 'skip'));
	const unapprovedCount = $derived(unapproved.data ?? 0);
	let addOpen = $state(false);

	const total = (list: Account[]) => list.reduce((sum, account) => sum + account.balance, 0);
	const linkClass =
		'flex min-h-9 items-center gap-3 rounded-md px-2.5 py-1.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-bold aria-[current=page]:text-sidebar-accent-foreground';
</script>

<a
	href={resolve('/')}
	class="flex items-center gap-2.5 px-5 pt-5 pb-4 text-lg font-bold tracking-tight"
>
	<BrandMark class="size-7" />
	Budge
</a>
<nav
	aria-label="Sections and Accounts"
	class="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-6"
>
	<ul class="flex flex-col gap-0.5">
		{#each SECTIONS as section (section.href)}
			{@const Icon = section.icon}
			<li>
				<a
					href={resolve(section.href)}
					aria-current={section.href === page.url.pathname ? 'page' : undefined}
					class={linkClass}
				>
					<Icon aria-hidden="true" class="size-5 shrink-0 text-muted-foreground" />
					<span class="flex-1">{section.label}</span>
					{#if section.href === '/accounts' && unapprovedCount > 0}
						<SectionBadge count={formatUnapprovedCount(unapprovedCount)} label="Unapproved" />
					{:else if section.href === '/bank' && bank.needingYou > 0}
						<SectionBadge
							count={String(bank.needingYou)}
							label="need you"
							tone={bank.broken ? 'bad' : 'warn'}
						/>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
	{#if ready}
		<div class="flex flex-col gap-3">
			<div class="flex items-center justify-between gap-2 pl-2.5">
				<h2 class="text-xs font-bold text-muted-foreground">Accounts</h2>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Add Account"
					onclick={() => (addOpen = true)}
				>
					<PlusIcon aria-hidden="true" />
				</Button>
			</div>
			{#if accounts.all.length === 0}
				<p class="px-2.5 text-xs text-muted-foreground">No Accounts yet.</p>
			{/if}
			{#each accounts.groups as group (group.label)}
				<section aria-labelledby="sidebar-{group.label}" class="flex flex-col gap-0.5">
					<h3
						id="sidebar-{group.label}"
						class="flex items-baseline justify-between gap-2 px-2.5 pb-1 text-xs text-muted-foreground"
					>
						{group.label}
						<span>{formatCents(total(group.accounts))}</span>
					</h3>
					<ul class="flex flex-col gap-0.5">
						{#each group.accounts as account (account._id)}
							{@const href = resolve('/(app)/accounts/[accountId]', { accountId: account._id })}
							<li>
								<a
									{href}
									aria-current={href === page.url.pathname ? 'page' : undefined}
									class={[linkClass, 'justify-between']}
								>
									<span class="truncate">{account.name}</span>
									<span class={['shrink-0 font-normal', account.balance < 0 && 'text-destructive']}>
										{formatCents(account.balance)}
									</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</nav>

{#if ready}
	<AccountDialog bind:open={addOpen} />
{/if}
