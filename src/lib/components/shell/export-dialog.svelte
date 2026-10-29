<script lang="ts">
	import { useConvexClient } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { localToday } from '$lib/domain/dates';
	import { downloadCsv, downloadJson, type BudgetExport } from '$lib/export';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const client = useConvexClient();
	let busy = $state(false);
	let error = $state('');

	async function exportAs(save: (data: BudgetExport, date: string) => void) {
		busy = true;
		error = '';
		try {
			save(await client.query(api.export.all, {}), localToday());
		} catch {
			error = "Budge couldn't export. Try again.";
		} finally {
			busy = false;
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={() => (error = '')}>
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
