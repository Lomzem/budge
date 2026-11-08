<script lang="ts">
	import DownloadIcon from '@lucide/svelte/icons/download';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SmartphoneIcon from '@lucide/svelte/icons/smartphone';
	import { useQuery } from 'convex-svelte';
	import { useClerkContext } from 'svelte-clerk';
	import { MediaQuery } from 'svelte/reactivity';

	import { api } from '$convex/_generated/api';
	import CutoverDate from '$lib/components/settings/cutover-date.svelte';
	import ExportDialog from '$lib/components/shell/export-dialog.svelte';
	import HomeScreenDialog from '$lib/components/shell/home-screen-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { THEME_CHOICES, getTheme, type ThemeChoice } from '$lib/theme.svelte';

	const theme = getTheme();
	const clerk = useClerkContext();
	const settings = useQuery(api.settings.get, {});
	const installed = new MediaQuery('(display-mode: standalone)');
	let exportOpen = $state(false);
	let homeScreenOpen = $state(false);

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
				<div class="flex flex-col gap-1">
					<h2 id="theme-heading" class="text-lg font-bold">Theme</h2>
					<p class="text-muted-foreground">Light and dark both keep every amount readable.</p>
				</div>
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
			<section aria-labelledby="data-heading" class="flex flex-col gap-3 p-5 sm:p-6">
				<div class="flex flex-col gap-1">
					<h2 id="data-heading" class="text-lg font-bold">Your data</h2>
					<p class="text-muted-foreground">
						Download everything in Budge as a backup, as CSV or JSON.
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button variant="outline" onclick={() => (exportOpen = true)}>
						<DownloadIcon aria-hidden="true" />
						Export…
					</Button>
					{#if !installed.current}
						<Button variant="outline" onclick={() => (homeScreenOpen = true)}>
							<SmartphoneIcon aria-hidden="true" />
							Add to Home Screen
						</Button>
					{/if}
				</div>
			</section>
			<section aria-labelledby="session-heading" class="flex flex-col gap-3 p-5 sm:p-6">
				<h2 id="session-heading" class="text-lg font-bold">Session</h2>
				<div>
					<Button variant="outline" onclick={() => void clerk.clerk?.signOut()}>
						<LogOutIcon aria-hidden="true" />
						Sign out
					</Button>
				</div>
			</section>
		</div>
	{/if}
</div>

<ExportDialog bind:open={exportOpen} />
<HomeScreenDialog bind:open={homeScreenOpen} />
