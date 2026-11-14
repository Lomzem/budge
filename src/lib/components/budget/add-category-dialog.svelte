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

	interface Group {
		id: Id<'categoryGroups'>;
		name: string;
	}

	let {
		open = $bindable(false),
		kind,
		groups
	}: {
		open?: boolean;

		kind: 'group' | 'category';
		groups: readonly Group[];
	} = $props();

	const NEW_GROUP = 'new';

	const dialog = new DialogSession();
	const createGroup = useMutation(api.categories.createGroup);
	const createCategory = useMutation(api.categories.create);

	let name = $state('');
	let groupId = $state('');
	let groupName = $state('');
	let created: Group | null = $state(null);
	let error = $state('');
	const title = $derived(kind === 'group' ? 'Add Category Group' : 'Add Category');
	const known = $derived(
		created === null || groups.some((g) => g.id === created?.id) ? groups : [...groups, created]
	);

	export function saving() {
		return dialog.pending('save');
	}

	export function reset(inGroup?: Id<'categoryGroups'>) {
		if (!dialog.openOrResume({}, 'save')) return;
		name = '';
		groupName = '';
		created = null;
		error = '';
		groupId = inGroup ?? groups[0]?.id ?? NEW_GROUP;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const group = known.find((g) => g.id === groupId);
		if (kind === 'category' && group === undefined && groupId !== NEW_GROUP) {
			error = 'Pick a Category Group.';
			return;
		}
		const added = await dialog.run('save', async () => {
			if (kind === 'group') {
				await createGroup({ name });
				return;
			}
			let target = group?.id;
			if (target === undefined) {
				target = await createGroup({ name: groupName });
				created = { id: target, name: groupName.trim() };
				groupId = target;
			}
			await createCategory({ groupId: target, name });
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
	<Dialog.Content
		returnFocus={{ fallback: mainRegion }}
		onOpenAutoFocus={(event: Event) => {
			event.preventDefault();
			const first = kind === 'category' && groupId === NEW_GROUP ? 'new-group' : 'name';
			document.getElementById(`add-category-${first}`)?.focus();
		}}
	>
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
						choices={[
							...known.map((group) => ({ value: group.id, label: group.name })),
							{ value: NEW_GROUP, label: 'New Category Group…' }
						]}
						onclosed={() => {
							if (groupId === NEW_GROUP) document.getElementById('add-category-new-group')?.focus();
						}}
					/>
				</div>
				{#if groupId === NEW_GROUP}
					<div class="flex flex-col gap-2">
						<Label for="add-category-new-group">Group name</Label>
						<Input id="add-category-new-group" bind:value={groupName} required autocomplete="off" />
					</div>
				{/if}
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
