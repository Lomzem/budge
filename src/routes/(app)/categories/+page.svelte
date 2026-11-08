<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { useMutation, useQuery } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { attempt } from '$lib/attempt';
	import AddCategoryDialog from '$lib/components/budget/add-category-dialog.svelte';
	import DeleteCategoryDialog from '$lib/components/categories/delete-category-dialog.svelte';
	import DeleteGroupDialog from '$lib/components/categories/delete-group-dialog.svelte';
	import RenameDialog from '$lib/components/categories/rename-dialog.svelte';
	import type { ManagedGroup, RenameTarget } from '$lib/components/categories/types';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	const list = useQuery(api.categories.list, {});
	const groups: ManagedGroup[] = $derived(list.data?.groups ?? []);

	const moveCategory = useMutation(api.categories.move);
	const moveGroup = useMutation(api.categories.moveGroup);
	const setHidden = useMutation(api.categories.setHidden);
	const setGroupHidden = useMutation(api.categories.setGroupHidden);

	let actionError = $state('');

	let adding: 'group' | 'category' = $state('group');
	let addingOpen = $state(false);
	let addDialog: { reset: () => void; saving: () => boolean } | undefined = $state();

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

	async function run(change: () => Promise<unknown>) {
		actionError = '';
		const changed = await attempt(change);
		if (!changed.ok) actionError = changed.error?.message ?? "Budge couldn't save that. Try again.";
	}
</script>

<svelte:head>
	<title>Categories · Budge</title>
</svelte:head>

{#snippet trigger(name: string, hidden: boolean)}
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				variant="ghost"
				size="icon"
				aria-label="{name}{hidden ? ' (hidden)' : ''} actions"
				{...props}
			>
				<EllipsisIcon aria-hidden="true" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
{/snippet}

{#snippet hiddenTag()}
	<span class="shrink-0 rounded-full bg-muted px-2 text-xs text-muted-foreground">Hidden</span>
{/snippet}

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-4">
		<div class="flex max-w-prose flex-col gap-1">
			<h1 class="text-2xl font-bold tracking-tight">Categories</h1>
			<p class="text-muted-foreground">
				Rename, reorder, hide, or delete Categories and their groups. Assign money to them on the
				Budget.
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={addDialog?.saving() === true && adding !== 'group'}
				onclick={() => {
					add('group');
				}}
			>
				<PlusIcon aria-hidden="true" />
				Add Category Group
			</Button>
			{#if groups.length > 0}
				<Button
					variant="outline"
					size="sm"
					disabled={addDialog?.saving() === true && adding !== 'category'}
					onclick={() => {
						add('category');
					}}
				>
					<PlusIcon aria-hidden="true" />
					Add Category
				</Button>
			{/if}
		</div>
	</header>

	<p role="alert" class="-my-4 min-h-6 text-sm text-destructive">{actionError}</p>

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
		<div class="flex max-w-2xl flex-col gap-4">
			{#each groups as group, groupIndex (group._id)}
				<section aria-labelledby="group-{group._id}" class="rounded-lg border bg-card">
					<div class="flex min-h-12 items-center gap-2 border-b py-1 pr-2 pl-4">
						<h2 id="group-{group._id}" class="min-w-0 flex-1 truncate font-bold">{group.name}</h2>
						{#if group.hidden}
							{@render hiddenTag()}
						{/if}
						<DropdownMenu.Root>
							{@render trigger(group.name, group.hidden)}
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
					</div>
					{#if group.categories.length === 0}
						<p class="px-4 py-3 text-muted-foreground">No Categories yet.</p>
					{:else}
						<ul class="flex flex-col divide-y">
							{#each group.categories as category, index (category._id)}
								<li class="flex min-h-11 min-w-0 items-center gap-2 py-1 pr-2 pl-4">
									<span
										class={['min-w-0 flex-1 truncate', category.hidden && 'text-muted-foreground']}
										>{category.name}</span
									>
									{#if category.hidden}
										{@render hiddenTag()}
									{/if}
									<DropdownMenu.Root>
										{@render trigger(category.name, category.hidden)}
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
