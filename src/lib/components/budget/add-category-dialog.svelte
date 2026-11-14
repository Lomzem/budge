<script lang="ts">
	import { useMutation } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import SelectField from '$lib/components/select-field.svelte';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import { mainRegion } from '$lib/focusReturn';

	let {
		open = $bindable(false),
		kind,
		groups
	}: {
		open?: boolean;

		kind: 'group' | 'category';
		groups: readonly { id: Id<'categoryGroups'>; name: string }[];
	} = $props();

	const dialog = new DialogSession();
	const createGroup = useMutation(api.categories.createGroup);
	const createCategory = useMutation(api.categories.create);

	let name = $state('');
	let groupId = $state('');
	let error = $state('');
	const title = $derived(kind === 'group' ? 'Add Category Group' : 'Add Category');

	export function saving() {
		return dialog.pending('save');
	}

	export function reset() {
		if (!dialog.openOrResume({}, 'save')) return;
		name = '';
		error = '';
		groupId = groups[0]?.id ?? '';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const group = groups.find((g) => g.id === groupId);
		if (kind === 'category' && !group) {
			error = 'Pick a Category Group.';
			return;
		}
		const added = await dialog.run('save', async () => {
			if (kind === 'group') await createGroup({ name });
			else if (group) await createCategory({ groupId: group.id, name });
		});
		if (added.ok) {
			open = false;
			return;
		}
		error = added.error?.message ?? "Budge couldn't add it. Try again.";
		open = true;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content returnFocus={{ fallback: mainRegion }}>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
		</Dialog.Header>
		<form class="flex flex-col gap-4" onsubmit={submit}>
			{#if kind === 'category'}
				<div class="flex flex-col gap-2">
					<Label for="add-category-group">Category Group</Label>
					<SelectField
						id="add-category-group"
						required
						bind:value={groupId}
						placeholder="Pick a group"
						choices={groups.map((group) => ({ value: group.id, label: group.name }))}
					/>
				</div>
			{/if}
			<div class="flex flex-col gap-2">
				<Label for="add-category-name">Name</Label>
				<Input id="add-category-name" bind:value={name} required autocomplete="off" />
			</div>
			<Dialog.Footer {error}>
				<Button type="submit" disabled={saving()}>Add</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
