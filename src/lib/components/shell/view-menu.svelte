<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getAccounts } from '$lib/accounts.svelte';
	import AccountDialog from '$lib/components/accounts/account-dialog.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { formatCents } from '$lib/domain/money';
	import { VIEWS } from '$lib/views';

	const accounts = getAccounts();
	let addOpen = $state(false);

	const views = $derived([
		...VIEWS.map((view) => ({ href: resolve(view.href), label: view.label })),
		...accounts.all.map((account) => ({
			href: resolve('/(app)/accounts/[accountId]', { accountId: account._id }),
			label: account.name
		}))
	]);
	const current = $derived(views.find((view) => view.href === page.url.pathname));
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button variant="outline" {...props}>
				<span class="text-muted-foreground">View</span>
				<span class="max-w-40 truncate">{current?.label ?? 'Budget'}</span>
				<ChevronDownIcon aria-hidden="true" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="start">
		{#each VIEWS as view (view.href)}
			{@const href = resolve(view.href)}
			<DropdownMenu.Item>
				{#snippet child({ props })}
					<a {href} aria-current={href === current?.href ? 'page' : undefined} {...props}
						>{view.label}</a
					>
				{/snippet}
			</DropdownMenu.Item>
		{/each}
		{#each accounts.groups as group (group.label)}
			<DropdownMenu.Separator />
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading>{group.label}</DropdownMenu.GroupHeading>
				{#each group.accounts as account (account._id)}
					{@const href = resolve('/(app)/accounts/[accountId]', { accountId: account._id })}
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a {href} aria-current={href === current?.href ? 'page' : undefined} {...props}>
								<span class="flex-1 truncate">{account.name}</span>
								<span class="tabular-nums">{formatCents(account.balance)}</span>
							</a>
						{/snippet}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Group>
		{/each}
		<DropdownMenu.Separator />
		<DropdownMenu.Item onSelect={() => (addOpen = true)}>Add Account</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<AccountDialog bind:open={addOpen} />
