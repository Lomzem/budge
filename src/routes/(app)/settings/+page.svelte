<script lang="ts">
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { useClerkContext } from 'svelte-clerk';

	import { getShellQueries } from '$lib/shellQueries.svelte';
	import CutoverDate from '$lib/components/settings/cutover-date.svelte';
	import ExportButtons from '$lib/components/settings/export-buttons.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { THEME_CHOICES, getTheme, type ThemeChoice } from '$lib/theme.svelte';

	const theme = getTheme();
	const clerk = useClerkContext();
	const { settings } = getShellQueries();

	const themeLabels: Record<ThemeChoice, string> = {
		system: 'Match this device',
		light: 'Light',
		dark: 'Dark'
	};
</script>

<svelte:head>
	<title>Settings · Budge</title>
</svelte:head>

<div class="flex max-w-2xl flex-col gap-6">
	<h1 class="text-2xl font-bold tracking-tight">Settings</h1>
	{#if settings.data === undefined && settings.error === undefined}
		<p role="status" class="text-muted-foreground">Loading…</p>
	{:else}
		<div class="flex flex-col divide-y rounded-lg border bg-card">
			<div class="p-5 sm:p-6">
				<CutoverDate />
			</div>
			<section aria-labelledby="theme-heading" class="flex flex-col gap-3 p-5 sm:p-6">
				<h2 id="theme-heading" class="text-lg font-bold">Theme</h2>
				<RadioGroup.Root
					aria-labelledby="theme-heading"
					value={theme.choice}
					onValueChange={(value) => {
						const choice = THEME_CHOICES.find((c) => c === value);
						if (choice) theme.choose(choice);
					}}
				>
					{#each THEME_CHOICES as choice (choice)}
						<div class="flex min-h-9 items-center gap-2">
							<RadioGroup.Item value={choice} id="theme-{choice}" />
							<Label for="theme-{choice}">{themeLabels[choice]}</Label>
						</div>
					{/each}
				</RadioGroup.Root>
			</section>
			<section aria-labelledby="export-heading" class="flex flex-col gap-3 p-5 sm:p-6">
				<h2 id="export-heading" class="text-lg font-bold">Export</h2>
				<ExportButtons />
			</section>
			<div class="p-5 sm:p-6">
				<Button variant="outline" onclick={() => void clerk.clerk?.signOut()}>
					<LogOutIcon aria-hidden="true" />
					Sign out
				</Button>
			</div>
		</div>
	{/if}
</div>
