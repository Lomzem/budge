<script lang="ts">
	import { useMutation } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { readPublicError } from '$lib/publicError';

	let {
		open = $bindable(false),
		accountId,
		currentName
	}: { open?: boolean; accountId: Id<'accounts'>; currentName: string } = $props();

	const rename = useMutation(api.accounts.rename);
	let name = $state('');
	let error = $state('');
	let saving = $state(false);

	$effect(() => {
		if (open) {
			name = currentName;
			error = '';
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		try {
			await rename({ accountId, name });
			open = false;
		} catch (thrown) {
			error = readPublicError(thrown)?.message ?? "Budge couldn't rename the Account. Try again.";
		} finally {
			saving = false;
		}
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
				<Button type="submit" disabled={saving}>Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
