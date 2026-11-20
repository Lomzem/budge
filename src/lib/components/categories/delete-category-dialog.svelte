<script lang="ts">
	import { useMutation } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import SelectField from '$lib/components/select-field.svelte';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import type { FocusDestination, FocusReturn } from '$lib/focusReturn';

	import type { ManagedGroup } from './types';

	let {
		open = $bindable(false),
		category,
		groups,
		focusAfterDelete
	}: {
		open?: boolean;
		category: { id: Id<'categories'>; name: string } | undefined;

		groups: readonly ManagedGroup[];

		focusAfterDelete: FocusDestination;
	} = $props();

	const remove = useMutation(api.categories.remove);

	const dialog = new DialogSession();
	let destinationId = $state('');
	let error = $state('');
	let deleted = false;

	const choices = $derived(
		groups
			.map((group) => ({
				...group,
				categories: group.categories.filter((c) => c._id !== category?.id)
			}))
			.filter((group) => group.categories.length > 0)
	);

	export function reset() {
		dialog.open({});
		destinationId = '';
		error = '';
		deleted = false;
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
		const removed = await dialog.run('save', () =>
			remove({ categoryId: id, destinationId: destination._id })
		);
		if (removed.ok) {
			deleted = true;
			open = false;
		} else error = removed.error?.message ?? "Budge couldn't delete the Category. Try again.";
	}

	const afterDelete: FocusReturn = {
		opener: (opened) => (deleted ? null : opened),
		get fallback() {
			return focusAfterDelete;
		}
	};
</script>

<Dialog.Root bind:open>
	<Dialog.Content returnFocus={afterDelete}>
		<Dialog.Header>
			<Dialog.Title>Delete {category?.name ?? 'Category'}</Dialog.Title>
			<Dialog.Description>
				Its Transactions and Assigned amounts move to the Category you pick, permanently.
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
					<SelectField
						id="delete-category-destination"
						required
						bind:value={destinationId}
						placeholder="Pick a Category"
						choices={choices.map((group) => ({
							group: group.name,
							choices: group.categories.map((choice) => ({ value: choice._id, label: choice.name }))
						}))}
					/>
				</div>
				<Dialog.Footer {error}>
					<Button type="submit" variant="destructive" disabled={dialog.pending('save')}
						>Delete Category</Button
					>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
