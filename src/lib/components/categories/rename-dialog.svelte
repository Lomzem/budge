<script lang="ts">
	import { useMutation } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import { attempt } from '$lib/attempt';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	import type { RenameTarget } from './types';

	let { open = $bindable(false), target }: { open?: boolean; target: RenameTarget | undefined } =
		$props();

	const renameCategory = useMutation(api.categories.rename);
	const renameGroup = useMutation(api.categories.renameGroup);

	let name = $state('');
	let error = $state('');
	let saving = $state(false);

	const openFor = () => target?.id;

	export function reset(next: RenameTarget) {
		name = next.name;
		error = '';
	}

	function rename(item: RenameTarget) {
		return item.kind === 'group'
			? renameGroup({ groupId: item.id, name })
			: renameCategory({ categoryId: item.id, name });
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!target) return;
		const item = target;
		saving = true;
		const renamed = await attempt(() => rename(item));
		saving = false;
		const anotherItemTookTheDialogOver = openFor() !== item.id;
		if (anotherItemTookTheDialogOver) return;
		if (renamed.ok) open = false;
		else error = renamed.error?.message ?? "Budge couldn't rename it. Try again.";
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
