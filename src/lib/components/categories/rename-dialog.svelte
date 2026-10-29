<script lang="ts">
	import { useMutation } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { readPublicError } from '$lib/publicError';

	import type { RenameTarget } from './types';

	let { open = $bindable(false), target }: { open?: boolean; target: RenameTarget | undefined } =
		$props();

	const renameCategory = useMutation(api.categories.rename);
	const renameGroup = useMutation(api.categories.renameGroup);

	let name = $state('');
	let error = $state('');
	let saving = $state(false);

	/** Which item the dialog is open for now; a save may outlast it. */
	const openFor = () => target?.id;

	/** Fills the form from `target`; the parent calls it before each open. */
	export function reset(next: RenameTarget) {
		name = next.name;
		error = '';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!target) return;
		const { id } = target;
		saving = true;
		try {
			if (target.kind === 'group') await renameGroup({ groupId: target.id, name });
			else await renameCategory({ categoryId: target.id, name });
			// Another item may have taken the dialog over while this saved; leave that one be.
			if (openFor() === id) open = false;
		} catch (thrown) {
			if (openFor() === id) {
				error = readPublicError(thrown)?.message ?? "Budge couldn't rename it. Try again.";
			}
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>
				{target?.kind === 'group' ? 'Rename Category Group' : 'Rename Category'}
			</Dialog.Title>
		</Dialog.Header>
		<form class="flex flex-col gap-4" onsubmit={submit}>
			<div class="flex flex-col gap-2">
				<Label for="rename-category-name">Name</Label>
				<Input id="rename-category-name" bind:value={name} required autocomplete="off" />
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
