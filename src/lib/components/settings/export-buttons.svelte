<script lang="ts">
	import DownloadIcon from '@lucide/svelte/icons/download';
	import { useConvexClient } from 'convex-svelte';

	import { attempt } from '$lib/attempt';
	import { Button } from '$lib/components/ui/button';
	import { localToday } from '$lib/domain/dates';
	import { downloadCsv, downloadJson, fetchExport, type BudgetExport } from '$lib/export';

	const client = useConvexClient();
	let downloading = $state(false);
	let outcome: { ok: boolean; text: string } | null = $state(null);

	async function exportAs(save: (data: BudgetExport, date: string) => string | Promise<string>) {
		downloading = true;
		outcome = null;
		const exported = await attempt(async () => save(await fetchExport(client), localToday()));
		downloading = false;
		outcome = exported.ok
			? { ok: true, text: exported.value }
			: { ok: false, text: "Budge couldn't export. Try again." };
	}
</script>

<svelte:window
	onbeforeunload={(event: BeforeUnloadEvent) => {
		if (downloading) event.preventDefault();
	}}
/>

<div class="flex flex-wrap items-center gap-2">
	<Button variant="outline" disabled={downloading} onclick={() => exportAs(downloadCsv)}>
		<DownloadIcon aria-hidden="true" />
		Download CSV
	</Button>
	<Button variant="outline" disabled={downloading} onclick={() => exportAs(downloadJson)}>
		<DownloadIcon aria-hidden="true" />
		Download JSON
	</Button>
</div>
<p role={outcome?.ok === false ? 'alert' : 'status'} class="min-h-5 text-sm">
	{#if downloading}
		<span class="text-muted-foreground">Downloading…</span>
	{:else if outcome}
		<span class={outcome.ok ? '' : 'text-destructive'}>{outcome.text}</span>
	{/if}
</p>
