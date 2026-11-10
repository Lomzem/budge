<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { untrack } from 'svelte';

	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import { localToday } from '$lib/domain/dates';
	import { downloadCsv, downloadJson, fetchExport, type BudgetExport } from '$lib/export';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const client = useConvexClient();
	const dialog = new DialogSession<object, 'export'>();
	const busy = $derived(dialog.pending('export'));
	let error = $state('');

	let downloading = $state(false);

	$effect(() => {
		if (open)
			untrack(() => {
				dialog.openOrResume({}, 'export');
			});
	});

	async function exportAs(save: (data: BudgetExport, date: string) => void | Promise<void>) {
		error = '';
		const exported = await dialog.run('export', async () => {
			const data = await fetchExport(client);
			downloading = true;
			return Promise.resolve()
				.then(() => save(data, localToday()))
				.finally(() => {
					downloading = false;
				});
		});
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
		<p role="status" class="min-h-10 text-sm text-muted-foreground">
			{downloading
				? 'Downloading… Keep this page open until every file has started.'
				: 'JSON is one file. CSV is one file per table, so your browser may ask to allow several downloads.'}
		</p>
		<Dialog.Footer {error}>
			<Button variant="outline" disabled={busy} onclick={() => exportAs(downloadCsv)}>
				Download CSV
			</Button>
			<Button disabled={busy} onclick={() => exportAs(downloadJson)}>Download JSON</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
