<script lang="ts">
	import { useConvexClient } from 'convex-svelte';

	import { attempt } from '$lib/attempt';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { localToday } from '$lib/domain/dates';
	import { downloadCsv, downloadJson, fetchExport, type BudgetExport } from '$lib/export';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const client = useConvexClient();
	let busy = $state(false);
	let error = $state('');

	let downloading = $state(false);

	async function exportAs(save: (data: BudgetExport, date: string) => void | Promise<void>) {
		busy = true;
		error = '';
		const exported = await attempt(async () => {
			const data = await fetchExport(client);
			downloading = true;
			await save(data, localToday());
		});
		busy = false;
		downloading = false;
		if (!exported.ok) error = "Budge couldn't export. Try again.";
	}

	function setOpen(next: boolean) {
		if (!downloading) open = next;
	}
</script>

<svelte:window
	onbeforeunload={(event: BeforeUnloadEvent) => {
		if (downloading) event.preventDefault();
	}}
/>

<Dialog.Root bind:open={() => open, setOpen} onOpenChange={() => (error = '')}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Export</Dialog.Title>
			<Dialog.Description>
				Download everything in Budge as a backup. Bank Connection tokens are left out.
			</Dialog.Description>
		</Dialog.Header>
		<p class="text-sm text-muted-foreground">
			JSON is one file. CSV is one file per table, so your browser may ask to allow several
			downloads.
		</p>
		{#if downloading}
			<p role="status" class="text-sm text-muted-foreground">
				Downloading… Keep this page open until every file has started.
			</p>
		{/if}
		{#if error}
			<p role="alert" class="text-sm text-destructive">{error}</p>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" disabled={busy} onclick={() => exportAs(downloadCsv)}>
				Download CSV
			</Button>
			<Button disabled={busy} onclick={() => exportAs(downloadJson)}>Download JSON</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
