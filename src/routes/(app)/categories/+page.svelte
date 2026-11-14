<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { useMutation, useQuery } from 'convex-svelte';
	import { tick } from 'svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { attempt } from '$lib/attempt';
	import AddCategoryDialog from '$lib/components/budget/add-category-dialog.svelte';
	import DeleteCategoryDialog from '$lib/components/categories/delete-category-dialog.svelte';
	import DeleteGroupDialog from '$lib/components/categories/delete-group-dialog.svelte';
	import InlineName from '$lib/components/categories/inline-name.svelte';
	import type { ManagedGroup } from '$lib/components/categories/types';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { moveInList, reorderHandle } from '$lib/reorder';

	type Listed = NonNullable<typeof list.data>;

	const list = useQuery(api.categories.list, {});
	let reordered = $state<{ from: Listed; groups: ManagedGroup[] } | null>(null);
	const groups: ManagedGroup[] = $derived(
		reordered !== null && reordered.from === list.data
			? reordered.groups
			: (list.data?.groups ?? [])
	);

	const renameCategory = useMutation(api.categories.rename);
	const renameGroup = useMutation(api.categories.renameGroup);
	const moveCategory = useMutation(api.categories.move);
	const moveGroup = useMutation(api.categories.moveGroup);
	const setHidden = useMutation(api.categories.setHidden);
	const setGroupHidden = useMutation(api.categories.setGroupHidden);

	let actionError = $state('');

	let adding: 'group' | 'category' = $state('group');
	let addingOpen = $state(false);
	let addDialog:
		{ reset: (inGroup?: Id<'categoryGroups'>) => void; saving: () => boolean } | undefined =
		$state();

	let renaming: string | null = $state(null);

	let deletingCategory: { id: Id<'categories'>; name: string } | undefined = $state();
	let deleteCategoryOpen = $state(false);
	let deleteCategoryDialog: { reset: () => void } | undefined = $state();

	let deletingGroup: ManagedGroup | undefined = $state();
	let deleteGroupOpen = $state(false);
	let deleteGroupDialog: { reset: () => void } | undefined = $state();

	function add(kind: 'group' | 'category', inGroup?: Id<'categoryGroups'>) {
		adding = kind;
		addDialog?.reset(inGroup);
		addingOpen = true;
	}

	function editing(id: string) {
		return {
			get current() {
				return renaming === id;
			},
			set current(on: boolean) {
				if (on) renaming = id;
				else if (renaming === id) renaming = null;
			}
		};
	}

	async function focusName(id: string) {
		await tick();
		document.querySelector<HTMLElement>(`[data-rename-id="${id}"]`)?.focus();
	}

	function reorder(next: ManagedGroup[], change: () => Promise<unknown>) {
		if (list.data === undefined) return;
		reordered = { from: list.data, groups: next };
		void run(change).then(() => {
			if (actionError !== '') reordered = null;
		});
	}

	function reorderGroup(from: number, to: number) {
		const group = groups[from];
		if (group === undefined) return;
		reorder(moveInList(groups, from, to), () => moveGroup({ groupId: group._id, index: to }));
	}

	function reorderCategory(groupIndex: number, from: number, to: number) {
		const group = groups[groupIndex];
		const category = group?.categories[from];
		if (group === undefined || category === undefined) return;
		reorder(
			groups.map((g, at) =>
				at === groupIndex ? { ...g, categories: moveInList(g.categories, from, to) } : g
			),
			() => moveCategory({ categoryId: category._id, groupId: group._id, index: to })
		);
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

{#snippet handle(name: string, index: number, count: number, onmove: (to: number) => void)}
	<span class="flex shrink-0 cursor-grab touch-none active:cursor-grabbing">
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label="Move {name}"
			aria-describedby="reorder-hint"
			aria-keyshortcuts="ArrowUp ArrowDown Home End"
			disabled={count < 2}
			{@attach reorderHandle(index, count, onmove)}
		>
			<GripVerticalIcon aria-hidden="true" />
		</Button>
	</span>
{/snippet}

{#snippet nameButton(id: string, name: string, extra: string)}
	<button
		type="button"
		data-rename-id={id}
		class={[
			'min-w-0 flex-1 truncate rounded-sm text-left underline-offset-4 hover:underline',
			extra
		]}
		aria-describedby="rename-hint"
		onclick={() => {
			renaming = id;
		}}
	>
		{name}
	</button>
{/snippet}

{#snippet hiddenTag()}
	<span class="shrink-0 rounded-full bg-muted px-2 text-xs text-muted-foreground">Hidden</span>
{/snippet}

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-4">
		<h1 class="text-2xl font-bold tracking-tight">Categories</h1>
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
		</div>
	</header>
	<p id="reorder-hint" class="sr-only">Press the arrow keys, Home or End to move it, or drag it.</p>
	<p id="rename-hint" class="sr-only">Rename</p>

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
				{@const groupEditing = editing(group._id)}
				<section
					aria-labelledby="group-{group._id}"
					data-reorder-item
					class="relative rounded-lg border bg-card transition-transform data-dragging:z-10 data-dragging:shadow-lg data-dragging:transition-none motion-reduce:transition-none"
				>
					<div class="flex min-h-12 items-center gap-1 border-b py-1 pr-2 pl-1">
						{@render handle(group.name, groupIndex, groups.length, (to: number) => {
							reorderGroup(groupIndex, to);
						})}
						<h2 id="group-{group._id}" class="flex min-w-0 flex-1 font-bold">
							<InlineName
								name={group.name}
								label="Category Group name"
								bind:editing={groupEditing.current}
								onsave={(name: string) => renameGroup({ groupId: group._id, name })}
								onleave={() => void focusName(group._id)}
							>
								{#snippet children(name: string)}
									{@render nameButton(group._id, name, '')}
								{/snippet}
							</InlineName>
						</h2>
						{#if group.hidden}
							{@render hiddenTag()}
						{/if}
						<Button
							variant="ghost"
							size="icon"
							aria-label="Add Category to {group.name}"
							disabled={addDialog?.saving() === true && adding !== 'category'}
							onclick={() => {
								add('category', group._id);
							}}
						>
							<PlusIcon aria-hidden="true" />
						</Button>
						<DropdownMenu.Root>
							{@render trigger(group.name, group.hidden)}
							<DropdownMenu.Content
								align="start"
								onCloseAutoFocus={(event: Event) => {
									if (renaming === group._id) event.preventDefault();
								}}
							>
								<DropdownMenu.Item
									onSelect={() => {
										renaming = group._id;
									}}
								>
									Rename
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
								{@const categoryEditing = editing(category._id)}
								<li
									data-reorder-item
									class="relative flex min-h-11 min-w-0 items-center gap-1 bg-card py-1 pr-2 pl-1 transition-transform data-dragging:z-10 data-dragging:shadow-lg data-dragging:transition-none motion-reduce:transition-none"
								>
									{@render handle(category.name, index, group.categories.length, (to: number) => {
										reorderCategory(groupIndex, index, to);
									})}
									<InlineName
										name={category.name}
										label="Category name"
										bind:editing={categoryEditing.current}
										onsave={(name: string) => renameCategory({ categoryId: category._id, name })}
										onleave={() => void focusName(category._id)}
									>
										{#snippet children(name: string)}
											{@render nameButton(
												category._id,
												name,
												category.hidden ? 'text-muted-foreground' : ''
											)}
										{/snippet}
									</InlineName>
									{#if category.hidden}
										{@render hiddenTag()}
									{/if}
									<DropdownMenu.Root>
										{@render trigger(category.name, category.hidden)}
										<DropdownMenu.Content
											align="start"
											onCloseAutoFocus={(event: Event) => {
												if (renaming === category._id) event.preventDefault();
											}}
										>
											<DropdownMenu.Item
												onSelect={() => {
													renaming = category._id;
												}}
											>
												Rename
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
