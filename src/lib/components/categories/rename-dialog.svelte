<script lang="ts">
	import { useMutation } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import { mainRegion } from '$lib/focusReturn';

	import type { RenameTarget } from './types';

	let { open = $bindable(false), target }: { open?: boolean; target: RenameTarget | undefined } =
		$props();

	const renameCategory = useMutation(api.categories.rename);
	const renameGroup = useMutation(api.categories.renameGroup);

	const dialog = new DialogSession();
	let name = $state('');
	let error = $state('');

	export function reset(next: RenameTarget) {
		dialog.open({});
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
		const renamed = await dialog.run('save', () => rename(item));
		if (renamed.ok) open = false;
		else error = renamed.error?.message ?? "Budge couldn't rename it. Try again.";
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content returnFocus={{ fallback: mainRegion }}>
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
			<Dialog.Footer {error}>
				<Button type="submit" disabled={dialog.pending('save')}>Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
