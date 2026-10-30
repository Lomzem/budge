<script lang="ts">
	import MenuIcon from '@lucide/svelte/icons/menu';
	import { useClerkContext } from 'svelte-clerk';
	import { MediaQuery } from 'svelte/reactivity';

	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { THEME_CHOICES, getTheme, type ThemeChoice } from '$lib/theme.svelte';

	import ExportDialog from './export-dialog.svelte';
	import HomeScreenDialog from './home-screen-dialog.svelte';

	// In the sidebar the trigger spans the column, and the menu takes the trigger's width.
	let { wide = false }: { wide?: boolean } = $props();

	const theme = getTheme();
	const clerk = useClerkContext();
	const installed = new MediaQuery('(display-mode: standalone)');
	let homeScreenOpen = $state(false);
	let exportOpen = $state(false);

	const themeLabels: Record<ThemeChoice, string> = {
		system: 'System',
		light: 'Light',
		dark: 'Dark'
	};
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			{#if wide}
				<button
					class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none aria-expanded:bg-sidebar-accent"
					{...props}
				>
					<MenuIcon aria-hidden="true" class="size-4" />
					Menu
				</button>
			{:else}
				<Button variant="ghost" {...props}>
					<MenuIcon aria-hidden="true" />
					Menu
				</Button>
			{/if}
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Group>
			<DropdownMenu.GroupHeading>Theme</DropdownMenu.GroupHeading>
			<DropdownMenu.RadioGroup
				value={theme.choice}
				onValueChange={(value) => {
					const choice = THEME_CHOICES.find((c) => c === value);
					if (choice) theme.choose(choice);
				}}
			>
				{#each THEME_CHOICES as choice (choice)}
					<DropdownMenu.RadioItem value={choice}>{themeLabels[choice]}</DropdownMenu.RadioItem>
				{/each}
			</DropdownMenu.RadioGroup>
		</DropdownMenu.Group>
		<DropdownMenu.Separator />
		<DropdownMenu.Item onSelect={() => (exportOpen = true)}>Export…</DropdownMenu.Item>
		{#if !installed.current}
			<DropdownMenu.Item onSelect={() => (homeScreenOpen = true)}>
				Add to Home Screen
			</DropdownMenu.Item>
		{/if}
		<DropdownMenu.Item onSelect={() => void clerk.clerk?.signOut()}>Sign out</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<HomeScreenDialog bind:open={homeScreenOpen} />
<ExportDialog bind:open={exportOpen} />
