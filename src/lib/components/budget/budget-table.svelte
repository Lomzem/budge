<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { tick } from 'svelte';

	import type { Id } from '$convex/_generated/dataModel';
	import { getBudgetMonth, type BudgetView } from '$lib/budget.svelte';
	import { CategoryActions } from '$lib/categoryActions.svelte';
	import DeleteCategoryDialog from '$lib/components/categories/delete-category-dialog.svelte';
	import DeleteGroupDialog from '$lib/components/categories/delete-group-dialog.svelte';
	import InlineName from '$lib/components/categories/inline-name.svelte';
	import type { ManagedGroup } from '$lib/components/categories/types';
	import { categoryMenu } from '$lib/components/menu/category-menu';
	import MenuEntries from '$lib/components/menu/menu-entries.svelte';
	import type { MenuEntry } from '$lib/components/menu/types';
	import { Button } from '$lib/components/ui/button';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Table from '$lib/components/ui/table';
	import { neededOf } from '$lib/domain/budget';
	import { formatCents } from '$lib/domain/money';
	import { keepRefusalInView } from '$lib/refusalInView';
	import { clickedTheRow } from '$lib/rowClick';

	import AssignNeededButton from './assign-needed-button.svelte';
	import AssignedInput from './assigned-input.svelte';
	import { availableStatus, waitingNotes } from './status';
	import TargetBar from './target-bar.svelte';

	type Group = BudgetView['groups'][number];
	type CategoryBudget = Group['categories'][number];

	let {
		groups,
		selectedId,
		collapsed,
		onselect,
		ontoggle,
		onadd
	}: {
		groups: BudgetView['groups'];

		selectedId: Id<'categories'> | null;

		collapsed: ReadonlySet<Id<'categoryGroups'>>;

		onselect: (id: Id<'categories'>) => void;

		ontoggle: (id: Id<'categoryGroups'>) => void;

		onadd: (group: { id: Id<'categoryGroups'>; name: string }) => void;
	} = $props();

	const budget = getBudgetMonth();
	const actions = new CategoryActions();

	const movable = $derived(groups.filter((group) => group.kind === 'normal'));

	let renaming: string | null = $state(null);
	let menuOpenFor: string | null = $state(null);

	let deletingCategory: { id: Id<'categories'>; name: string } | undefined = $state();
	let deleteCategoryOpen = $state(false);
	let deleteCategoryDialog: { reset: () => void } | undefined = $state();

	let deletingGroup: ManagedGroup | undefined = $state();
	let deleteGroupOpen = $state(false);
	let deleteGroupDialog: { reset: () => void } | undefined = $state();

	function editing(id: string) {
		return {
			get current() {
				return renaming === id;
			},
			set current(on: boolean) {
				if (on) renaming ??= id;
				else if (renaming === id) renaming = null;
			}
		};
	}

	function focusVisible(selector: string) {
		[...document.querySelectorAll<HTMLElement>(selector)]
			.find((element) => element.checkVisibility())
			?.focus();
	}

	function focusName(id: Id<'categories'>) {
		focusVisible(`[data-category-id="${id}"]`);
	}

	async function focusAfterRename(selector: string) {
		await tick();
		focusVisible(selector);
	}

	function categoryEntries(category: CategoryBudget): MenuEntry[] {
		return categoryMenu(actions, category.id, {
			rename: () => {
				renaming = category.id;
			},
			remove: () => {
				deletingCategory = { id: category.id, name: category.name };
				deleteCategoryDialog?.reset();
				deleteCategoryOpen = true;
			}
		});
	}

	function groupEntries(group: Group): MenuEntry[] {
		const at = movable.findIndex((other) => other.id === group.id);
		const above = movable[at - 1];
		const below = movable[at + 1];
		return [
			{
				kind: 'item',
				label: 'Add Category',
				run: () => {
					onadd({ id: group.id, name: group.name });
				}
			},
			{
				kind: 'item',
				label: 'Rename',
				run: () => {
					renaming = group.id;
				}
			},
			{
				kind: 'item',
				label: 'Move up',
				disabled: above === undefined,
				run: () => {
					if (above) actions.placeGroup(group.id, above.id);
				}
			},
			{
				kind: 'item',
				label: 'Move down',
				disabled: below === undefined,
				run: () => {
					if (below) actions.placeGroup(group.id, below.id);
				}
			},
			{
				kind: 'item',
				label: 'Hide',
				run: () => {
					void actions.setGroupHidden(group.id, true);
				}
			},
			{ kind: 'separator' },
			{
				kind: 'item',
				label: 'Delete…',
				destructive: true,
				run: () => {
					deletingGroup = actions.groups.find((managed) => managed._id === group.id);
					deleteGroupDialog?.reset();
					deleteGroupOpen = true;
				}
			}
		];
	}

	function keepFocusForRename(id: string) {
		return (event: Event) => {
			if (renaming === id) event.preventDefault();
		};
	}

	function tracksMenu(id: string) {
		return (open: boolean) => {
			if (open) menuOpenFor = id;
			else if (menuOpenFor === id) menuOpenFor = null;
		};
	}

	function clickClosingAMenuOnlyClosesIt(node: HTMLElement) {
		let dismissing = false;
		const readMenuBeforeItsDismissal = () => {
			dismissing = menuOpenFor !== null;
		};
		const click = (event: MouseEvent) => {
			if (!dismissing || event.detail === 0) return;
			dismissing = false;
			event.stopPropagation();
		};
		window.addEventListener('pointerdown', readMenuBeforeItsDismissal, true);
		node.addEventListener('click', click, true);
		return () => {
			window.removeEventListener('pointerdown', readMenuBeforeItsDismissal, true);
			node.removeEventListener('click', click, true);
		};
	}

	function rowClick(id: string, open: () => void) {
		return (event: MouseEvent) => {
			if (menuOpenFor === id || renaming === id || !clickedTheRow(event)) return;
			open();
		};
	}
</script>

{#snippet name(category: CategoryBudget)}
	{@const status = availableStatus(category)}
	{@const selected = category.id === selectedId}
	{@const needed = neededOf(category)}
	{@const nameEditing = editing(category.id)}
	<InlineName
		name={category.name}
		label="Category name"
		bind:editing={nameEditing.current}
		onsave={(next: string) => actions.rename(category.id, next)}
		onleave={() => {
			void focusAfterRename(`[data-category-id="${category.id}"]`);
		}}
	>
		{#snippet children(shown: string)}
			<button
				type="button"
				class="block w-full rounded-sm text-left font-medium break-words whitespace-normal underline-offset-4 hover:underline xs:pl-3 pointer-coarse:py-2"
				aria-expanded={selected}
				aria-controls={selected ? 'category-inspector' : undefined}
				data-category-id={category.id}
				onclick={() => {
					onselect(category.id);
				}}
			>
				{shown}
			</button>
		{/snippet}
	</InlineName>
	{#if category.target}
		<div class="mt-1 xs:pl-3">
			<TargetBar
				progress={category.target.progress}
				label="{category.name} Target"
				text={status?.text ?? ''}
			/>
		</div>
	{/if}
	{#if status?.text && status.class !== 'text-funded'}
		<span class="block text-xs whitespace-normal xs:pl-3 {status.class}">{status.text}</span>
	{/if}
	{#if needed > 0}
		<div class="mt-1 xs:pl-3">
			<AssignNeededButton
				categoryId={category.id}
				{needed}
				label="Assign {formatCents(needed)} to {category.name}"
				size="xs"
				variant="outline"
				onassigned={() => {
					focusName(category.id);
				}}
			/>
		</div>
	{/if}
	{#each waitingNotes(category) as note (note)}
		<span class="hidden pl-3 text-xs whitespace-normal text-muted-foreground sm:block">{note}</span>
	{/each}
	{#if actions.failure?.id === category.id}
		<p role="alert" class="text-xs text-destructive xs:pl-3" {@attach keepRefusalInView}>
			{actions.failure.message}
		</p>
	{/if}
{/snippet}

{#snippet stackedAvailable(cents: number, tone: string)}
	<span class="mt-1 block text-xs font-medium tabular-nums @md:hidden {tone}"
		><span class="sr-only">Available </span>{formatCents(cents)}</span
	>
{/snippet}

{#snippet groupHeader(group: Group, shut: boolean)}
	{@const overspent = group.categories.filter((c) => c.status === 'overspent').length}
	{@const nameEditing = editing(group.id)}
	<div class="flex items-center gap-1">
		<InlineName
			name={group.name}
			label="Category Group name"
			bind:editing={nameEditing.current}
			onsave={(next: string) => actions.renameGroup(group.id, next)}
			onleave={() => {
				void focusAfterRename(`[data-group-id="${group.id}"]`);
			}}
		>
			{#snippet children(shown: string)}
				<button
					type="button"
					class="flex min-w-0 flex-1 items-start gap-1 rounded-sm text-left text-foreground pointer-coarse:py-2"
					aria-expanded={!shut}
					data-group-id={group.id}
					onclick={() => {
						ontoggle(group.id);
					}}
				>
					<ChevronRightIcon
						aria-hidden="true"
						class={[
							'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
							!shut && 'rotate-90'
						]}
					/>
					<span class="min-w-0">
						<span class="block text-sm font-semibold break-words whitespace-normal">{shown}</span>
						{#if shut && overspent > 0}
							<span class="block text-xs font-medium whitespace-normal text-destructive">
								{overspent} overspent
							</span>
						{/if}
					</span>
				</button>
			{/snippet}
		</InlineName>
		{#if group.kind === 'normal'}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button variant="ghost" size="icon-xs" aria-label="{group.name} actions" {...props}>
							<EllipsisIcon aria-hidden="true" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" onCloseAutoFocus={keepFocusForRename(group.id)}>
					<MenuEntries menu="dropdown" entries={groupEntries(group)} />
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}
	</div>
	{#if actions.failure?.id === group.id}
		<p role="alert" class="mt-1 text-xs font-normal text-destructive" {@attach keepRefusalInView}>
			{actions.failure.message}
		</p>
	{/if}
{/snippet}

{#snippet groupCells(group: Group)}
	<Table.Cell align="end" numeric>
		<span class="font-medium">{formatCents(group.assigned)}</span>
		{@render stackedAvailable(group.available, group.available < 0 ? 'text-destructive' : '')}
	</Table.Cell>
	<Table.Cell align="end" numeric showFrom="xl">
		<span class="font-medium">{formatCents(group.activity)}</span>
	</Table.Cell>
	<Table.Cell align="end" numeric showFrom="md">
		<span class={['font-medium', group.available < 0 && 'text-destructive']}
			>{formatCents(group.available)}</span
		>
	</Table.Cell>
{/snippet}

<div class="@container" {@attach clickClosingAMenuOnlyClosesIt}>
	<Table.Root layout="fixed">
		<Table.Header>
			<Table.Row>
				<Table.Head>Category</Table.Head>
				<Table.Head width="assigned" align="end">
					Assigned
					<span class="block @md:hidden">Available</span>
				</Table.Head>
				<Table.Head width="amount" align="end" showFrom="xl">Activity</Table.Head>
				<Table.Head width="amount" align="end" showFrom="md">Available</Table.Head>
			</Table.Row>
		</Table.Header>
		{#each groups as group (group.id)}
			{@const shut = collapsed.has(group.id)}
			<Table.Body>
				<ContextMenu.Root onOpenChange={tracksMenu(group.id)}>
					<ContextMenu.Trigger disabled={group.kind !== 'normal'}>
						{#snippet child({ props })}
							<Table.Row
								{...props}
								tabindex={undefined}
								data-state={undefined}
								weight="group"
								opens
								holds={group.kind === 'normal'}
								onclick={rowClick(group.id, () => {
									ontoggle(group.id);
								})}
							>
								<Table.Head scope="rowgroup" variant="group">
									{@render groupHeader(group, shut)}
								</Table.Head>
								{@render groupCells(group)}
							</Table.Row>
						{/snippet}
					</ContextMenu.Trigger>
					<ContextMenu.Content onCloseAutoFocus={keepFocusForRename(group.id)}>
						<MenuEntries menu="context" entries={groupEntries(group)} />
					</ContextMenu.Content>
				</ContextMenu.Root>
				{#if !shut}
					{#each group.categories as category (category.id)}
						{@const status = availableStatus(category)}
						{@const selected = category.id === selectedId}
						<ContextMenu.Root onOpenChange={tracksMenu(category.id)}>
							<ContextMenu.Trigger disabled={group.kind !== 'normal'}>
								{#snippet child({ props })}
									<Table.Row
										{...props}
										tabindex={undefined}
										data-state={selected ? 'selected' : undefined}
										opens
										holds={group.kind === 'normal'}
										onclick={rowClick(category.id, () => {
											onselect(category.id);
										})}
									>
										<Table.Cell>{@render name(category)}</Table.Cell>
										<Table.Cell align="end">
											<AssignedInput
												quiet
												amount={category.assigned}
												label="Assigned for {category.name}"
												onsave={(cents: number) => budget.setAssigned(category.id, cents)}
											/>
											{@render stackedAvailable(category.available, status?.class ?? '')}
										</Table.Cell>
										<Table.Cell align="end" numeric showFrom="xl">
											{formatCents(category.activity)}
										</Table.Cell>
										<Table.Cell align="end" numeric showFrom="md">
											<span class={['font-medium', status?.class]}
												>{formatCents(category.available)}</span
											>
										</Table.Cell>
									</Table.Row>
								{/snippet}
							</ContextMenu.Trigger>
							<ContextMenu.Content onCloseAutoFocus={keepFocusForRename(category.id)}>
								<MenuEntries menu="context" entries={categoryEntries(category)} />
							</ContextMenu.Content>
						</ContextMenu.Root>
					{:else}
						<Table.Row>
							<Table.Cell colspan={4}>
								<span class="pl-3 text-muted-foreground">No Categories yet.</span>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		{/each}
	</Table.Root>
</div>

<DeleteCategoryDialog
	bind:this={deleteCategoryDialog}
	bind:open={deleteCategoryOpen}
	category={deletingCategory}
	groups={actions.groups}
/>
<DeleteGroupDialog
	bind:this={deleteGroupDialog}
	bind:open={deleteGroupOpen}
	group={deletingGroup}
	groups={actions.groups}
/>
