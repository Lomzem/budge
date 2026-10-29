<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { useMutation, useQuery } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import AddCategoryDialog from '$lib/components/budget/add-category-dialog.svelte';
	import DeleteCategoryDialog from '$lib/components/categories/delete-category-dialog.svelte';
	import DeleteGroupDialog from '$lib/components/categories/delete-group-dialog.svelte';
	import RenameDialog from '$lib/components/categories/rename-dialog.svelte';
	import type { ManagedGroup, RenameTarget } from '$lib/components/categories/types';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { readPublicError } from '$lib/publicError';

	const list = useQuery(api.categories.list, {});
	const groups: ManagedGroup[] = $derived(list.data?.groups ?? []);

	const moveCategory = useMutation(api.categories.move);
	const moveGroup = useMutation(api.categories.moveGroup);
	const setHidden = useMutation(api.categories.setHidden);
	const setGroupHidden = useMutation(api.categories.setGroupHidden);

	let actionError = $state('');

	let adding: 'group' | 'category' = $state('group');
	let addingOpen = $state(false);
	let addingSaving = $state(false);
	let addDialog: { reset: () => void } | undefined = $state();

	let renameTarget: RenameTarget | undefined = $state();
	let renameOpen = $state(false);
	let renameDialog: { reset: (target: RenameTarget) => void } | undefined = $state();

	let deletingCategory: { id: Id<'categories'>; name: string } | undefined = $state();
	let deleteCategoryOpen = $state(false);
	let deleteCategoryDialog: { reset: () => void } | undefined = $state();

	let deletingGroup: ManagedGroup | undefined = $state();
	let deleteGroupOpen = $state(false);
	let deleteGroupDialog: { reset: () => void } | undefined = $state();

	function add(kind: 'group' | 'category') {
		adding = kind;
		addDialog?.reset();
		addingOpen = true;
	}

	function rename(target: RenameTarget) {
		renameTarget = target;
		renameDialog?.reset(target);
		renameOpen = true;
	}

	function deleteCategory(category: { id: Id<'categories'>; name: string }) {
		deletingCategory = category;
		deleteCategoryDialog?.reset();
		deleteCategoryOpen = true;
	}

	function deleteGroup(group: ManagedGroup) {
		deletingGroup = group;
		deleteGroupDialog?.reset();
		deleteGroupOpen = true;
	}

	/** Runs a change from a menu, showing what failed above the list. */
	async function run(change: () => Promise<unknown>) {
		actionError = '';
		try {
			await change();
		} catch (thrown) {
			actionError = readPublicError(thrown)?.message ?? "Budge couldn't save that. Try again.";
		}
	}
</script>

<svelte:head>
	<title>Categories · Budge</title>
</svelte:head>

{#snippet trigger(name: string, hidden: boolean, heading: boolean)}
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<!-- A plain button, so a long name truncates instead of widening the page at 320 px. -->
			<button
				class={[
					'flex max-w-full min-w-0 items-center gap-1 rounded-md px-2 py-1 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-expanded:bg-muted',
					heading ? 'font-semibold' : 'text-sm'
				]}
				aria-label="{name}{hidden ? ' (hidden)' : ''} actions"
				{...props}
			>
				<span class="truncate">{name}</span>
				<ChevronDownIcon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" />
			</button>
		{/snippet}
	</DropdownMenu.Trigger>
{/snippet}

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-3">
		<h1 class="text-xl font-semibold">Categories</h1>
		<div class="flex flex-wrap gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={addingSaving && adding !== 'group'}
				onclick={() => {
					add('group');
				}}
			>
				Add Category Group
			</Button>
			{#if groups.length > 0}
				<Button
					variant="outline"
					size="sm"
					disabled={addingSaving && adding !== 'category'}
					onclick={() => {
						add('category');
					}}
				>
					Add Category
				</Button>
			{/if}
		</div>
	</header>

	{#if actionError}
		<p role="alert" class="text-sm text-destructive">{actionError}</p>
	{/if}

	{#if list.error}
		<p role="alert" class="text-sm text-destructive">
			Budge couldn't load the Categories. Try reloading the page.
		</p>
	{:else if !list.data}
		<p role="status" class="text-muted-foreground">Loading…</p>
	{:else if groups.length === 0}
		<p class="text-muted-foreground">
			No Categories yet. Add a Category Group, then Categories to assign money to.
		</p>
	{:else}
		<div class="flex max-w-2xl flex-col gap-6">
			{#each groups as group, groupIndex (group._id)}
				<section aria-labelledby="group-{group._id}" class="flex flex-col gap-1">
					<div class="flex items-center gap-2 border-b pb-1">
						<h2 id="group-{group._id}" class="min-w-0">
							<DropdownMenu.Root>
								{@render trigger(group.name, group.hidden, true)}
								<DropdownMenu.Content align="start">
									<DropdownMenu.Item
										onSelect={() => {
											rename({ kind: 'group', id: group._id, name: group.name });
										}}
									>
										Rename
									</DropdownMenu.Item>
									<DropdownMenu.Item
										disabled={groupIndex === 0}
										onSelect={() =>
											void run(() => moveGroup({ groupId: group._id, index: groupIndex - 1 }))}
									>
										Move up
									</DropdownMenu.Item>
									<DropdownMenu.Item
										disabled={groupIndex === groups.length - 1}
										onSelect={() =>
											void run(() => moveGroup({ groupId: group._id, index: groupIndex + 1 }))}
									>
										Move down
									</DropdownMenu.Item>
									<DropdownMenu.Item
										onSelect={() =>
											void run(() => setGroupHidden({ groupId: group._id, hidden: !group.hidden }))}
									>
										{group.hidden ? 'Show in budget' : 'Hide from budget'}
									</DropdownMenu.Item>
									<DropdownMenu.Separator />
									<DropdownMenu.Item
										variant="destructive"
										onSelect={() => {
											deleteGroup(group);
										}}
									>
										Delete…
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</h2>
						{#if group.hidden}
							<span class="text-sm text-muted-foreground">Hidden</span>
						{/if}
					</div>
					{#if group.categories.length === 0}
						<p class="py-1 pl-3 text-sm text-muted-foreground">No Categories yet.</p>
					{:else}
						<ul class="flex flex-col">
							{#each group.categories as category, index (category._id)}
								<li class="flex min-w-0 items-center gap-2 pl-3">
									<DropdownMenu.Root>
										{@render trigger(category.name, category.hidden, false)}
										<DropdownMenu.Content align="start">
											<DropdownMenu.Item
												onSelect={() => {
													rename({ kind: 'category', id: category._id, name: category.name });
												}}
											>
												Rename
											</DropdownMenu.Item>
											<DropdownMenu.Item
												disabled={index === 0}
												onSelect={() =>
													void run(() =>
														moveCategory({
															categoryId: category._id,
															groupId: group._id,
															index: index - 1
														})
													)}
											>
												Move up
											</DropdownMenu.Item>
											<DropdownMenu.Item
												disabled={index === group.categories.length - 1}
												onSelect={() =>
													void run(() =>
														moveCategory({
															categoryId: category._id,
															groupId: group._id,
															index: index + 1
														})
													)}
											>
												Move down
											</DropdownMenu.Item>
											{#if groups.length > 1}
												<DropdownMenu.Sub>
													<DropdownMenu.SubTrigger>Move to group</DropdownMenu.SubTrigger>
													<DropdownMenu.SubContent>
														{#each groups.filter((g) => g._id !== group._id) as other (other._id)}
															<DropdownMenu.Item
																onSelect={() =>
																	void run(() =>
																		moveCategory({
																			categoryId: category._id,
																			groupId: other._id,
																			index: other.categories.length
																		})
																	)}
															>
																{other.name}
															</DropdownMenu.Item>
														{/each}
													</DropdownMenu.SubContent>
												</DropdownMenu.Sub>
											{/if}
											<DropdownMenu.Item
												onSelect={() =>
													void run(() =>
														setHidden({ categoryId: category._id, hidden: !category.hidden })
													)}
											>
												{category.hidden ? 'Show in budget' : 'Hide from budget'}
											</DropdownMenu.Item>
											<DropdownMenu.Separator />
											<DropdownMenu.Item
												variant="destructive"
												onSelect={() => {
													deleteCategory({ id: category._id, name: category.name });
												}}
											>
												Delete…
											</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu.Root>
									{#if category.hidden}
										<span class="text-sm text-muted-foreground">Hidden</span>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</div>

<AddCategoryDialog
	bind:this={addDialog}
	bind:open={addingOpen}
	bind:saving={addingSaving}
	kind={adding}
	groups={groups.map((group) => ({ id: group._id, name: group.name }))}
/>
<RenameDialog bind:this={renameDialog} bind:open={renameOpen} target={renameTarget} />
<DeleteCategoryDialog
	bind:this={deleteCategoryDialog}
	bind:open={deleteCategoryOpen}
	category={deletingCategory}
	{groups}
/>
<DeleteGroupDialog
	bind:this={deleteGroupDialog}
	bind:open={deleteGroupOpen}
	group={deletingGroup}
	{groups}
/>
