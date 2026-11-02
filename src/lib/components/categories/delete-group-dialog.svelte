<script lang="ts">
	import { useMutation } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import { attempt } from '$lib/attempt';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';

	import type { ManagedGroup } from './types';

	let {
		open = $bindable(false),
		group,
		groups
	}: {
		open?: boolean;
		group: ManagedGroup | undefined;

		groups: readonly ManagedGroup[];
	} = $props();

	const removeGroup = useMutation(api.categories.removeGroup);

	let destinationId = $state('');
	let error = $state('');
	let saving = $state(false);

	const openFor = () => group?._id;

	const choices = $derived(groups.filter((g) => g._id !== group?._id));
	const count = $derived(group?.categories.length ?? 0);

	export function reset() {
		destinationId = '';
		error = '';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!group) return;
		const destination = choices.find((g) => g._id === destinationId);
		if (count > 0 && !destination) {
			error = 'Pick a group to move its Categories to.';
			return;
		}
		const id = group._id;
		saving = true;
		const removed = await attempt(() =>
			removeGroup({
				groupId: id,
				...(destination ? { destinationGroupId: destination._id } : {})
			})
		);
		saving = false;
		const anotherGroupTookTheDialogOver = openFor() !== id;
		if (anotherGroupTookTheDialogOver) return;
		if (removed.ok) open = false;
		else error = removed.error?.message ?? "Budge couldn't delete the group. Try again.";
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Delete {group?.name ?? 'Category Group'}</Dialog.Title>
			<Dialog.Description>
				{#if count > 0}
					Its {count === 1 ? 'Category moves' : `${String(count)} Categories move`} to the group you pick,
					with all their history.
				{:else}
					It has no Categories.
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		{#if count > 0 && choices.length === 0}
			<p class="text-sm text-muted-foreground">
				Add another Category Group first, to take over this one's Categories.
			</p>
		{:else}
			<form class="flex flex-col gap-4" onsubmit={submit}>
				{#if count > 0}
					<div class="flex flex-col gap-2">
						<Label for="delete-group-destination">Move its Categories to</Label>
						<select
							id="delete-group-destination"
							bind:value={destinationId}
							required
							class="h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm"
						>
							<option value="" disabled>Pick a group</option>
							{#each choices as choice (choice._id)}
								<option value={choice._id}>{choice.name}</option>
							{/each}
						</select>
					</div>
				{/if}
				{#if error}
					<p role="alert" class="text-sm text-destructive">{error}</p>
				{/if}
				<Dialog.Footer>
					<Button type="submit" variant="destructive" disabled={saving}>Delete group</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
