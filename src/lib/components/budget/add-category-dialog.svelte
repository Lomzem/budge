<script lang="ts">
	import { useMutation } from 'convex-svelte';
	import { untrack } from 'svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { readPublicError } from '$lib/publicError';

	let {
		open = $bindable(false),
		kind,
		groups
	}: {
		open?: boolean;
		/** A Category Group, or a Category within one of `groups`. */
		kind: 'group' | 'category';
		groups: readonly { id: Id<'categoryGroups'>; name: string }[];
	} = $props();

	const createGroup = useMutation(api.categories.createGroup);
	const createCategory = useMutation(api.categories.create);

	// The parent mounts a fresh dialog for each open, so this is the reset.
	let name = $state('');
	let groupId = $state(untrack(() => groups[0]?.id ?? ''));
	let error = $state('');
	let saving = $state(false);
	const title = $derived(kind === 'group' ? 'Add Category Group' : 'Add Category');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const group = groups.find((g) => g.id === groupId);
		if (kind === 'category' && !group) {
			error = 'Pick a Category Group.';
			return;
		}
		saving = true;
		try {
			if (kind === 'group') await createGroup({ name });
			else if (group) await createCategory({ groupId: group.id, name });
			open = false;
		} catch (thrown) {
			error = readPublicError(thrown)?.message ?? "Budge couldn't add it. Try again.";
		} finally {
			saving = false;
		}
	}
</script>

<!-- It stays open while saving: reopening mounts a fresh dialog, which could submit it twice. -->
<Dialog.Root
	bind:open={
		() => open,
		(next: boolean) => {
			if (!saving) open = next;
		}
	}
>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
		</Dialog.Header>
		<form class="flex flex-col gap-4" onsubmit={submit}>
			{#if kind === 'category'}
				<div class="flex flex-col gap-2">
					<Label for="add-category-group">Category Group</Label>
					<select
						id="add-category-group"
						bind:value={groupId}
						required
						class="h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm"
					>
						{#each groups as group (group.id)}
							<option value={group.id}>{group.name}</option>
						{/each}
					</select>
				</div>
			{/if}
			<div class="flex flex-col gap-2">
				<Label for="add-category-name">Name</Label>
				<Input id="add-category-name" bind:value={name} required autocomplete="off" />
			</div>
			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}
			<Dialog.Footer>
				<Button type="submit" disabled={saving}>Add</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
