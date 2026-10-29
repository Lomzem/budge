<script lang="ts">
	import { useMutation } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import { readPublicError } from '$lib/publicError';

	import type { ManagedGroup } from './types';

	let {
		open = $bindable(false),
		category,
		groups
	}: {
		open?: boolean;
		category: { id: Id<'categories'>; name: string } | undefined;
		/** Every group, to pick the Category that takes over the history from. */
		groups: readonly ManagedGroup[];
	} = $props();

	const remove = useMutation(api.categories.remove);

	let destinationId = $state('');
	let error = $state('');
	let saving = $state(false);

	/** Which item the dialog is open for now; a save may outlast it. */
	const openFor = () => category?.id;

	const choices = $derived(
		groups
			.map((group) => ({
				...group,
				categories: group.categories.filter((c) => c._id !== category?.id)
			}))
			.filter((group) => group.categories.length > 0)
	);

	/** Empties the form; the parent calls it before each open. */
	export function reset() {
		destinationId = '';
		error = '';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const destination = choices
			.flatMap((group) => group.categories)
			.find((c) => c._id === destinationId);
		if (!category || !destination) {
			error = 'Pick a Category to move its history to.';
			return;
		}
		const { id } = category;
		saving = true;
		try {
			await remove({ categoryId: id, destinationId: destination._id });
			// Another Category may have taken the dialog over while this saved; leave that one be.
			if (openFor() === id) open = false;
		} catch (thrown) {
			if (openFor() === id) {
				error =
					readPublicError(thrown)?.message ?? "Budge couldn't delete the Category. Try again.";
			}
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Delete {category?.name ?? 'Category'}</Dialog.Title>
			<Dialog.Description>
				Its Transactions and Assigned amounts move to the Category you pick, in every month, so
				every Available stays exact. This can't be undone.
			</Dialog.Description>
		</Dialog.Header>
		{#if choices.length === 0}
			<p class="text-sm text-muted-foreground">
				Add another Category first, to take over this one's history.
			</p>
		{:else}
			<form class="flex flex-col gap-4" onsubmit={submit}>
				<div class="flex flex-col gap-2">
					<Label for="delete-category-destination">Move its history to</Label>
					<select
						id="delete-category-destination"
						bind:value={destinationId}
						required
						class="h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm"
					>
						<option value="" disabled>Pick a Category</option>
						{#each choices as group (group._id)}
							<optgroup label={group.name}>
								{#each group.categories as choice (choice._id)}
									<option value={choice._id}>{choice.name}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</div>
				{#if error}
					<p role="alert" class="text-sm text-destructive">{error}</p>
				{/if}
				<Dialog.Footer>
					<Button type="submit" variant="destructive" disabled={saving}>Delete Category</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
