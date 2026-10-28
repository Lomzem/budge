<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { VIEWS } from '$lib/views';

	const current = $derived(VIEWS.find((view) => view.href === page.url.pathname));
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button variant="outline" {...props}>
				<span class="text-muted-foreground">View</span>
				{current?.label ?? 'Budget'}
				<ChevronDownIcon aria-hidden="true" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="start">
		{#each VIEWS as view (view.href)}
			<DropdownMenu.Item>
				{#snippet child({ props })}
					<a
						href={resolve(view.href)}
						aria-current={view === current ? 'page' : undefined}
						{...props}>{view.label}</a
					>
				{/snippet}
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
