<script lang="ts">
	import { useQuery } from 'convex-svelte';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import { getBankConnections } from '$lib/bankConnections.svelte';
	import { formatUnapprovedCount } from '$lib/domain/unapproved';
	import { SECTIONS, sectionOf } from '$lib/views';

	import SectionBadge from './section-badge.svelte';

	const bank = getBankConnections();
	const unapproved = useQuery(api.transactions.unapprovedCount, {});
	const unapprovedCount = $derived(unapproved.data ?? 0);
	const current = $derived(sectionOf(page.url.pathname));

	function currentness(href: string): 'page' | 'true' | undefined {
		if (current?.href !== href) return undefined;
		return href === page.url.pathname ? 'page' : 'true';
	}
</script>

<nav
	aria-label="Sections"
	class="fixed inset-x-0 bottom-0 z-40 border-t bg-sidebar pb-safe text-sidebar-foreground lg:hidden"
>
	<ul class="mx-auto grid max-w-lg grid-cols-5">
		{#each SECTIONS as section (section.href)}
			{@const Icon = section.icon}
			<li>
				<a
					href={resolve(section.href)}
					aria-current={currentness(section.href)}
					class="group flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground aria-[current]:text-sidebar-accent-foreground"
				>
					<span class="group-aria-[current]:font-bold">{section.label}</span>
					<span
						class="relative order-first flex h-7 w-14 items-center justify-center rounded-full group-aria-[current]:bg-sidebar-accent"
					>
						<Icon aria-hidden="true" class="size-5" />
						{#if section.href === '/accounts' && unapprovedCount > 0}
							<span class="absolute -top-1.5 left-8">
								<SectionBadge count={formatUnapprovedCount(unapprovedCount)} label="Unapproved" />
							</span>
						{:else if section.href === '/bank' && bank.needingYou > 0}
							<span class="absolute -top-1.5 left-8">
								<SectionBadge count={String(bank.needingYou)} label="need you" />
							</span>
						{/if}
					</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>
