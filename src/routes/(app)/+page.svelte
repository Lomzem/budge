<script lang="ts">
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Result } from 'effect';
	import { tick, untrack } from 'svelte';
	import { on } from 'svelte/events';
	import { MediaQuery, SvelteSet } from 'svelte/reactivity';

	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import { getShellQueries } from '$lib/shellQueries.svelte';
	import type { Id } from '$convex/_generated/dataModel';
	import { getAccounts } from '$lib/accounts.svelte';
	import { getBankConnections } from '$lib/bankConnections.svelte';
	import { getBudgetMonth } from '$lib/budget.svelte';
	import AccountDialog from '$lib/components/accounts/account-dialog.svelte';
	import AddCategoryDialog from '$lib/components/budget/add-category-dialog.svelte';
	import BudgetTable from '$lib/components/budget/budget-table.svelte';
	import CategoryInspector from '$lib/components/budget/category-inspector.svelte';
	import HiddenCategories from '$lib/components/budget/hidden-categories.svelte';
	import MonthPicker from '$lib/components/budget/month-picker.svelte';
	import UpcomingList from '$lib/components/budget/upcoming-list.svelte';
	import CutoverDate from '$lib/components/settings/cutover-date.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { isIsoMonth, monthOf } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';
	import { formatUnapprovedCount } from '$lib/domain/unapproved';
	import { formatBankChangeCount } from '$lib/domain/bankChanges';
	import { firstVisible, mainRegion, type FocusDestination } from '$lib/focusReturn';
	import { keepInUrl } from '$lib/keepInUrl';
	import { ScrollArea } from '$lib/components/ui/scroll-area';

	const accounts = getAccounts();
	const bank = getBankConnections();
	const budget = getBudgetMonth();

	const monthAt = (url: URL, returnedToAnEntry: boolean) => {
		const linked = url.searchParams.get('month');
		if (linked !== null && isIsoMonth(linked)) return linked;
		return returnedToAnEntry ? monthOf(budget.today) : budget.month;
	};
	budget.month = monthAt(page.url, navigating.type === 'popstate');
	let arrivedAt = page.url;
	$effect(() => {
		const url = page.url;
		if (url === arrivedAt) return;
		arrivedAt = url;
		budget.month = untrack(() => monthAt(url, navigating.type === 'popstate'));
	});
	$effect(() =>
		on(window, 'popstate', () => {
			const shownWithoutNavigating = page.url.href === location.href;
			if (shownWithoutNavigating) budget.month = monthAt(page.url, true);
		})
	);
	$effect(() => {
		const kept = new URL(location.href);
		if (budget.month === monthOf(budget.today)) kept.searchParams.delete('month');
		else kept.searchParams.set('month', budget.month);
		keepInUrl(kept);
	});
	const { settings, unapprovedCount: unapproved, bankChangeCount: bankChanges } = getShellQueries();
	const unapprovedCount = $derived(unapproved.data ?? 0);
	const bankChangeCount = $derived(bankChanges.data ?? { count: 0, complete: true });
	let addAccountOpen = $state(false);
	let cutoverUnsetOnArrival = $state(false);

	$effect(() => {
		if (settings.data?.cutoverDate === null) cutoverUnsetOnArrival = true;
	});
	let adding: 'group' | 'category' = $state('group');
	let addingOpen = $state(false);

	let addDialog:
		{ reset: (inGroup?: Id<'categoryGroups'>) => void; saving: () => boolean } | undefined =
		$state();

	const COLLAPSED_KEY = 'budge.collapsedGroups';
	const collapsed = new SvelteSet<Id<'categoryGroups'>>(rememberedCollapsed());

	function rememberedCollapsed(): Id<'categoryGroups'>[] {
		const stored = Result.try(() => {
			const parsed: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
			return Array.isArray(parsed)
				? parsed.filter((id): id is Id<'categoryGroups'> => typeof id === 'string')
				: [];
		});
		return Result.isSuccess(stored) ? stored.success : [];
	}

	function rememberCollapsed() {
		Result.try(() => {
			localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
		});
	}

	function toggleGroup(id: Id<'categoryGroups'>) {
		if (collapsed.has(id)) collapsed.delete(id);
		else collapsed.add(id);
		rememberCollapsed();
	}

	function expandGroupOf(id: Id<'categories'>) {
		const group = view?.groups.find((g) => g.categories.some((c) => c.id === id));
		if (group === undefined || !collapsed.has(group.id)) return;
		collapsed.delete(group.id);
		rememberCollapsed();
	}

	const view = $derived(budget.shown);
	const readyToAssign = $derived(budget.readyToAssign);
	const ready = $derived(view !== undefined && (bank.loaded || bank.failed));
	const groupsACategoryCanJoin = $derived(
		view?.groups
			.filter((group) => group.kind === 'normal')
			.map((group) => ({ id: group.id, name: group.name })) ?? []
	);

	const wide = new MediaQuery('(min-width: 1024px)');
	let selectedId: Id<'categories'> | null = $state(null);

	const shownCategories = $derived(view?.groups.flatMap((group) => group.categories) ?? []);
	const selected = $derived(shownCategories.find((c) => c.id === selectedId));
	let lastSelected = $state<typeof selected>();
	$effect.pre(() => {
		if (selected) lastSelected = selected;
	});
	const inspected = $derived(selected ?? lastSelected);
	const selectedGroupId = $derived(
		selectedId === null
			? undefined
			: view?.groups.find((group) => group.categories.some((c) => c.id === selectedId))?.id
	);
	let besideSelected: string[] = [];
	$effect.pre(() => {
		if (selected === undefined || view === undefined) return;
		const group = view.groups.find((g) => g.categories.some((c) => c.id === selected.id));
		if (group === undefined) return;
		const at = group.categories.findIndex((c) => c.id === selected.id);
		const neighbour = group.categories[at + 1] ?? group.categories[at - 1];
		besideSelected = [
			...(neighbour === undefined ? [] : [`[data-category-id="${neighbour.id}"]`]),
			`[data-group-id="${group.id}"]`
		];
	});

	const besideTheLastSelected: FocusDestination = () =>
		firstVisible(besideSelected) ?? mainRegion();

	let selectedPlacement: { id: Id<'categories'>; group: Id<'categoryGroups'> } | null = null;
	$effect.pre(() => {
		const id = selectedId;
		const group = selectedGroupId;
		if (id === null || group === undefined) return;
		const movedGroups = selectedPlacement?.id === id && selectedPlacement.group !== group;
		selectedPlacement = { id, group };
		if (movedGroups)
			untrack(() => {
				expandGroupOf(id);
			});
	});

	interface Need {
		text: string;
		short?: string;
		link?: { path: '/transactions' | '/bank'; query: string };
		action?: () => void;
		tone: 'bad' | 'warn';
	}

	const needs = $derived.by((): Need[] => {
		if (view === undefined) return [];
		const list: Need[] = [];
		if (readyToAssign && readyToAssign.amount < 0) {
			list.push({
				text: `Assigned ${formatCents(-readyToAssign.amount)} more than you have`,
				tone: 'bad'
			});
		}
		if (view.overspent.length > 0) {
			const count = view.overspent.length;
			const shownOverspent = view.overspent.filter((over) =>
				shownCategories.some((c) => c.id === over.id)
			);
			list.push({
				text: `${String(count)} ${count === 1 ? 'Category' : 'Categories'} overspent`,
				short: `${String(count)} overspent`,
				...(shownOverspent.length === 0
					? {}
					: { action: () => void stepOverspent(shownOverspent.map((over) => over.id)) }),
				tone: 'bad'
			});
		}
		if (bank.needingYou > 0) {
			list.push({
				text: `Bank: ${String(bank.needingYou)} ${bank.needingYou === 1 ? 'thing needs' : 'things need'} you`,
				short: `Bank: ${String(bank.needingYou)} to do`,
				link: { path: '/bank', query: '' },
				tone: bank.broken ? 'bad' : 'warn'
			});
		}
		if (view.uncategorizedCount > 0) {
			const count = view.uncategorizedCount;
			list.push({
				text: `${String(count)} Uncategorized`,
				link: { path: '/transactions', query: '?category=uncategorized' },
				tone: 'warn'
			});
		}
		if (unapprovedCount > 0) {
			list.push({
				text: `${formatUnapprovedCount(unapprovedCount)} Unapproved`,
				link: { path: '/transactions', query: '?status=unapproved' },
				tone: 'warn'
			});
		}
		if (bankChangeCount.count > 0 || !bankChangeCount.complete) {
			list.push({
				text: formatBankChangeCount(bankChangeCount),
				link: { path: '/transactions', query: '?status=bank-changes' },
				tone: 'warn'
			});
		}
		return list;
	});

	let needsList = $state<HTMLElement | null>(null);
	let needsBefore = $state(false);
	let needsAfter = $state(false);

	function measureNeeds() {
		if (needsList === null) return;
		const { scrollLeft, scrollWidth, clientWidth } = needsList;
		needsBefore = scrollLeft > 1;
		needsAfter = scrollLeft + clientWidth < scrollWidth - 1;
	}

	$effect(() => {
		const list = needsList;
		if (!list || needs.length === 0) return;
		const observer = new ResizeObserver(measureNeeds);
		observer.observe(list);
		for (const child of Array.from(list.children)) observer.observe(child);
		return () => {
			observer.disconnect();
		};
	});

	function scrollNeeds(direction: -1 | 1) {
		if (needsList === null) return;
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		needsList.scrollBy({
			left: direction * needsList.clientWidth * 0.75,
			behavior: still ? 'instant' : 'smooth'
		});
	}

	async function select(id: Id<'categories'>, keepOpen = false) {
		selectedId = selectedId === id && !keepOpen ? null : id;
		if (selectedId !== null) expandGroupOf(selectedId);
		if (selectedId !== null && wide.current) {
			await tick();
			document.getElementById('category-inspector')?.focus({ preventScroll: true });
		}
	}

	async function stepOverspent(ids: Id<'categories'>[]) {
		const at = selectedId === null ? -1 : ids.indexOf(selectedId);
		const target = ids[(at + 1) % ids.length];
		if (target === undefined) return;
		await select(target, true);
		[...document.querySelectorAll<HTMLElement>(`[data-category-id="${target}"]`)]
			.find((button) => button.checkVisibility())
			?.scrollIntoView({ block: 'center' });
	}

	function stepsAround(id: Id<'categories'>) {
		const at = shownCategories.findIndex((c) => c.id === id);
		const near = (offset: number) => {
			const category = at === -1 ? undefined : shownCategories[at + offset];
			return category === undefined ? undefined : { id: category.id, name: category.name };
		};
		return { previous: near(-1), next: near(1) };
	}

	async function stepTo(id: Id<'categories'>) {
		selectedId = id;
		expandGroupOf(id);
		await tick();
		document
			.getElementById('category-inspector')
			?.closest('[data-slot="dialog-body"]')
			?.scrollTo({ top: 0 });
		document
			.querySelector<HTMLInputElement>('#category-inspector input[data-assigned]')
			?.focus({ preventScroll: true });
	}

	function leaveEscapeInsideTheInspectorToIt(event: KeyboardEvent) {
		if (document.getElementById('category-inspector')?.contains(document.activeElement))
			event.preventDefault();
	}

	async function closeInspector() {
		const id = selectedId;
		selectedId = null;
		await tick();
		if (id === null) return;
		const row = [...document.querySelectorAll<HTMLElement>(`[data-category-id="${id}"]`)].find(
			(button) => button.checkVisibility()
		);
		(row ?? mainRegion())?.focus();
	}

	$effect(() => {
		if (selectedId === null || view === undefined || budget.stale || selected !== undefined) return;
		void (async () => {
			selectedId = null;
			await tick();
			if (document.activeElement === null || document.activeElement === document.body) {
				besideTheLastSelected()?.focus();
			}
		})();
	});

	function add(kind: 'group' | 'category', inGroup?: Id<'categoryGroups'>) {
		adding = kind;
		addDialog?.reset(inGroup);
		addingOpen = true;
	}
</script>

<svelte:head>
	<title>Budget · Budge</title>
</svelte:head>

{#if budget.error}
	<p role="alert" class="text-destructive">
		Budge couldn't load the budget. Try reloading the page.
	</p>
{:else if !ready || view === undefined}
	<p role="status" class="text-muted-foreground">Loading…</p>
{:else}
	<div class="flex flex-col gap-4 sm:gap-6">
		<header class="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 sm:gap-y-4">
			<div class="flex w-full flex-col gap-1 sm:w-auto">
				<h1 class="text-2xl font-bold tracking-tight max-sm:sr-only">Budget</h1>
				<div class="-ml-2 flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						aria-label="Previous month"
						disabled={!budget.canGoBack}
						onclick={() => {
							budget.previous();
						}}
					>
						<ChevronLeftIcon />
					</Button>
					<h2 aria-live="polite" class="min-w-40 text-center text-lg font-bold whitespace-nowrap">
						<MonthPicker />
					</h2>
					<Button
						variant="ghost"
						size="icon"
						aria-label="Next month"
						onclick={() => {
							budget.next();
						}}
					>
						<ChevronRightIcon />
					</Button>
					<div class={['max-xs:hidden', budget.onThisMonth && 'invisible']}>
						<Button
							variant="ghost"
							size="sm"
							onclick={() => {
								budget.thisMonth();
							}}
						>
							<CalendarCheckIcon aria-hidden="true" />
							<span class="max-sm:sr-only">This month</span>
						</Button>
					</div>
					<div class="ml-auto sm:hidden">{@render editCategoriesMenu()}</div>
				</div>
			</div>
			{#if readyToAssign}
				<div
					class="flex w-full items-baseline justify-between gap-4 sm:w-auto sm:flex-col sm:items-end sm:gap-0"
				>
					<p class="text-sm font-medium text-muted-foreground">Ready to Assign</p>
					<p
						data-testid="ready-to-assign"
						class={[
							'text-xl leading-tight font-bold whitespace-nowrap tabular-nums sm:text-2xl',
							readyToAssign.amount < 0 ? 'text-destructive' : 'text-funded'
						]}
					>
						{formatCents(readyToAssign.amount)}
					</p>
				</div>
			{/if}
		</header>

		{#if cutoverUnsetOnArrival}
			<div class="max-w-2xl rounded-lg border bg-card p-5 sm:p-6">
				<CutoverDate />
			</div>
		{/if}

		{#snippet needText(need: Need)}
			{#if need.short === undefined}
				{need.text}
			{:else}
				<span class="sm:hidden">{need.short}</span><span class="hidden sm:inline">{need.text}</span>
			{/if}
		{/snippet}
		{#snippet needsScroller(direction: -1 | 1, shown: boolean)}
			<button
				type="button"
				tabindex="-1"
				aria-hidden="true"
				class={[
					'absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground pointer-coarse:hidden',
					direction === 1 ? 'right-0' : 'left-0',
					!shown && 'invisible'
				]}
				onclick={() => {
					scrollNeeds(direction);
				}}
			>
				{#if direction === 1}
					<ChevronRightIcon class="size-4" />
				{:else}
					<ChevronLeftIcon class="size-4" />
				{/if}
			</button>
		{/snippet}
		{#if needs.length > 0}
			<section
				aria-label="Needs you"
				class="relative -my-1 flex h-10 items-center pointer-coarse:h-13"
			>
				<div
					class={[
						'-mx-1 flex min-w-0 flex-1 fade-edges',
						needsBefore && 'fade-start',
						needsAfter && 'fade-end'
					]}
				>
					<ScrollArea orientation="horizontal" bind:viewportRef={needsList} onscroll={measureNeeds}>
						<ul class="flex gap-2 p-1">
							{#each needs as need (need.text)}
								{@const chip = [
									'flex min-h-8 items-center rounded-full px-3 text-sm font-bold whitespace-nowrap pointer-coarse:min-h-11',
									need.tone === 'bad'
										? 'bg-destructive-tint text-destructive'
										: 'bg-warning-tint text-warning'
								]}
								<li class="shrink-0 snap-start">
									{#if need.link}
										<a
											href="{resolve(need.link.path)}{need.link.query}"
											class={[chip, 'underline-offset-4 hover:underline']}
										>
											{@render needText(need)}
										</a>
									{:else if need.action}
										<button
											type="button"
											class={[chip, 'underline-offset-4 hover:underline']}
											onclick={need.action}
										>
											{@render needText(need)}
										</button>
									{:else}
										<span class={chip}>{@render needText(need)}</span>
									{/if}
								</li>
							{/each}
						</ul>
					</ScrollArea>
				</div>
				{@render needsScroller(-1, needsBefore)}
				{@render needsScroller(1, needsAfter)}
			</section>
		{/if}

		{#if accounts.all.length === 0 && settings.data?.cutoverDate !== null}
			<section
				class="flex max-w-2xl flex-col items-start gap-3 rounded-lg border border-dashed border-input p-6"
			>
				<p class="font-bold">No Accounts yet</p>
				<div class="flex flex-wrap gap-2">
					<Button onclick={() => (addAccountOpen = true)}>
						<PlusIcon aria-hidden="true" />
						Add Account
					</Button>
					<Button variant="outline" href={resolve('/bank')}>Connect a bank</Button>
				</div>
			</section>
		{/if}

		<section aria-label="Categories" class="flex flex-col gap-3">
			<div class="hidden flex-wrap gap-2 sm:flex">
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
			{#if view.groups.length > 0}
				<div class="lg:flex lg:items-start lg:gap-8" aria-busy={budget.stale}>
					<div class={['min-w-0 flex-1', budget.stale && 'opacity-60']} inert={budget.stale}>
						<BudgetTable
							groups={view.groups}
							selectedId={selected?.id ?? null}
							{collapsed}
							onselect={select}
							ontoggle={toggleGroup}
							onadd={(group: { id: Id<'categoryGroups'>; name: string }) => {
								add('category', group.id);
							}}
						/>
					</div>
					{#if wide.current}
						<div
							class={[
								'sticky top-8 -m-1 flex max-h-side-panel-height w-82 shrink-0 flex-col',
								budget.stale && 'opacity-60'
							]}
							inert={budget.stale}
						>
							<ScrollArea>
								<div class="flex flex-col gap-6 p-1">
									{#if selected}
										<div class="rounded-lg border bg-card p-5">{@render inspector()}</div>
									{:else}
										<UpcomingList upcoming={view.upcoming} today={budget.today} />
									{/if}
								</div>
							</ScrollArea>
						</div>
					{/if}
				</div>
				{#if !wide.current}
					<UpcomingList upcoming={view.upcoming} today={budget.today} />
				{/if}
			{:else}
				<UpcomingList upcoming={view.upcoming} today={budget.today} />
			{/if}
		</section>

		<HiddenCategories hidden={view.hidden} reveal={expandGroupOf} />
	</div>
{/if}

{#snippet editCategoriesMenu()}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button variant="ghost" size="icon" aria-label="Add Category or Group" {...props}>
					<PlusIcon aria-hidden="true" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item
				disabled={addDialog?.saving() === true && adding !== 'group'}
				onSelect={() => {
					add('group');
				}}
			>
				Add Category Group
			</DropdownMenu.Item>
			<DropdownMenu.Item
				disabled={addDialog?.saving() === true && adding !== 'category'}
				onSelect={() => {
					add('category');
				}}
			>
				Add Category
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

{#snippet inspector()}
	{#if view && inspected}
		{#key inspected.id}
			<CategoryInspector
				category={inspected}
				{view}
				editAssigned={!wide.current}
				readyToAssign={wide.current ? undefined : readyToAssign?.amount}
				steps={wide.current ? undefined : stepsAround(inspected.id)}
				onstep={stepTo}
				onclose={closeInspector}
				focusAfterRemoval={besideTheLastSelected}
			/>
		{/key}
	{/if}
{/snippet}

{#if !wide.current}
	<Dialog.Root
		open={selected !== undefined}
		onOpenChange={(open) => {
			if (!open) void closeInspector();
		}}
	>
		<Dialog.Content
			showCloseButton={false}
			aria-label={selected?.name}
			onOpenAutoFocus={(event: Event) => {
				event.preventDefault();
				document.getElementById('category-inspector')?.focus({ preventScroll: true });
			}}
			onEscapeKeydown={leaveEscapeInsideTheInspectorToIt}
			returnFocus={{ fallback: besideTheLastSelected }}
		>
			{@render inspector()}
		</Dialog.Content>
	</Dialog.Root>
{/if}

<AccountDialog bind:open={addAccountOpen} />
<AddCategoryDialog
	bind:this={addDialog}
	bind:open={addingOpen}
	kind={adding}
	groups={groupsACategoryCanJoin}
/>
