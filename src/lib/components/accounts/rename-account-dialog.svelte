<script lang="ts">
	import { useMutation } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { DialogSession } from '$lib/dialogSession.svelte';

	let {
		open = $bindable(false),
		accountId,
		currentName
	}: { open?: boolean; accountId: Id<'accounts'>; currentName: string } = $props();

	const rename = useMutation(api.accounts.rename);
	let name = $state('');
	let error = $state('');
	const dialog = new DialogSession();

	$effect(() => {
		if (open) {
			dialog.open({});
			name = currentName;
			error = '';
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const renamed = await dialog.run('save', () => rename({ accountId, name }));
		if (renamed.ok) open = false;
		else error = renamed.error?.message ?? "Budge couldn't rename the Account. Try again.";
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Rename Account</Dialog.Title>
		</Dialog.Header>
		<form class="flex flex-col gap-4" onsubmit={submit}>
			<div class="flex flex-col gap-2">
				<Label for="rename-account-name">Name</Label>
				<Input id="rename-account-name" bind:value={name} required autocomplete="off" />
			</div>
			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}
			<Dialog.Footer>
				<Button type="submit" disabled={dialog.pending('save')}>Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
