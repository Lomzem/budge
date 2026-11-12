<script lang="ts">
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { useQuery } from 'convex-svelte';
	import { tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ResolvedPathname } from '$app/types';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getAccounts } from '$lib/accounts.svelte';
	import { getBankConnections } from '$lib/bankConnections.svelte';
	import { getBudgetMonth } from '$lib/budget.svelte';
	import AccountDialog from '$lib/components/accounts/account-dialog.svelte';
	import AddCategoryDialog from '$lib/components/budget/add-category-dialog.svelte';
	import BudgetTable from '$lib/components/budget/budget-table.svelte';
	import CategoryInspector from '$lib/components/budget/category-inspector.svelte';
	import UpcomingList from '$lib/components/budget/upcoming-list.svelte';
	import CutoverDate from '$lib/components/settings/cutover-date.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { formatMonth, isIsoMonth, monthOf } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';
	import { formatUnapprovedCount } from '$lib/domain/unapproved';
	import { formatBankChangeCount } from '$lib/domain/bankChanges';
	import { ScrollArea } from '$lib/components/ui/scroll-area';

	const accounts = getAccounts();
	const bank = getBankConnections();
	const budget = getBudgetMonth();

	const monthIn = (url: URL) => {
		const linked = url.searchParams.get('month');
		return linked !== null && isIsoMonth(linked) ? linked : undefined;
	};
	budget.month = monthIn(page.url) ?? budget.month;
	let arrivedAt = page.url;
	$effect(() => {
		const url = page.url;
		if (url === arrivedAt) return;
		arrivedAt = url;
		const linked = monthIn(url);
		if (linked !== undefined) budget.month = linked;
	});
	$effect(() => {
		const kept = new URL(location.href);
		if (budget.month === monthOf(budget.today)) kept.searchParams.delete('month');
		else kept.searchParams.set('month', budget.month);
		if (kept.href === location.href) return;
		replaceState(`${kept.pathname}${kept.search}${kept.hash}` as ResolvedPathname, page.state);
	});
	const settings = useQuery(api.settings.get, {});
	const unapproved = useQuery(api.transactions.unapprovedCount, {});
	const unapprovedCount = $derived(unapproved.data ?? 0);
	const bankChanges = useQuery(api.transactions.bankChangeCount, {});
	const bankChangeCount = $derived(bankChanges.data ?? { count: 0, complete: true });
	let addAccountOpen = $state(false);
	let cutoverUnsetOnArrival = $state(false);

	$effect(() => {
		if (settings.data?.cutoverDate === null) cutoverUnsetOnArrival = true;
	});
	let adding: 'group' | 'category' = $state('group');
	let addingOpen = $state(false);

	let addDialog: { reset: () => void; saving: () => boolean } | undefined = $state();

	const view = $derived(budget.shown);
	const readyToAssign = $derived(budget.readyToAssign);
	const ready = $derived(
		view !== undefined &&
			settings.data !== undefined &&
			unapproved.data !== undefined &&
			bankChanges.data !== undefined &&
			(bank.loaded || bank.failed)
	);
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

	interface Need {
		text: string;
		short?: string;
		link?: { path: '/accounts' | '/bank'; query: string };
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
				link: { path: '/accounts', query: '?category=uncategorized' },
				tone: 'warn'
			});
		}
		if (unapprovedCount > 0) {
			list.push({
				text: `${formatUnapprovedCount(unapprovedCount)} Unapproved`,
				link: { path: '/accounts', query: '?status=unapproved' },
				tone: 'warn'
			});
		}
		if (bankChangeCount.count > 0 || !bankChangeCount.complete) {
			list.push({
				text: formatBankChangeCount(bankChangeCount),
				link: { path: '/accounts', query: '?status=bank-changes' },
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
		await tick();
		document
			.getElementById('category-inspector')
			?.closest('[data-slot="dialog-body"]')
			?.scrollTo({ top: 0 });
		document
			.querySelector<HTMLInputElement>('#category-inspector input[data-assigned]')
			?.focus({ preventScroll: true });
	}

	async function closeInspector() {
		const id = selectedId;
		selectedId = null;
		await tick();
		if (id !== null) {
			[...document.querySelectorAll<HTMLElement>(`[data-category-id="${id}"]`)]
				.find((button) => button.checkVisibility())
				?.focus();
		}
	}

	function add(kind: 'group' | 'category') {
		adding = kind;
		addDialog?.reset();
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
					<h2 aria-live="polite" class="min-w-40 text-center text-lg font-bold">
						{formatMonth(budget.month)}
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
					class={[
						'grid w-full grid-cols-label-figure items-baseline gap-x-3 gap-y-0.5 rounded-lg px-4 py-3 xs:gap-x-4 sm:w-auto sm:gap-x-8 sm:px-5',
						readyToAssign.amount < 0 ? 'bg-destructive-tint' : 'bg-funded-tint'
					]}
				>
					<p class="text-sm font-bold whitespace-nowrap">Ready to Assign</p>
					<p
						data-testid="ready-to-assign"
						class={[
							'text-right text-lg leading-tight font-bold whitespace-nowrap tabular-nums xs:text-2xl sm:row-span-2 sm:self-center sm:text-3xl',
							readyToAssign.amount < 0 ? 'text-destructive' : 'text-funded'
						]}
					>
						{formatCents(readyToAssign.amount)}
					</p>
					<p class="col-span-2 min-h-4 text-xs sm:col-span-1">
						{#if readyToAssign.uncategorized < 0}
							{formatCents(-readyToAssign.uncategorized)} of spending has no Category yet
						{:else if readyToAssign.uncategorized > 0}
							{formatCents(readyToAssign.uncategorized)} of income has no Category yet
						{/if}
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
		<section
			aria-label="Needs you"
			class="relative -my-1 flex h-10 items-center pointer-coarse:h-13"
		>
			{#if needs.length === 0}
				<p class="flex items-center gap-2 text-muted-foreground">
					<CircleCheckIcon aria-hidden="true" class="size-5 text-funded" />
					Nothing needs you right now.
				</p>
			{:else}
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
			{/if}
		</section>

		{#if accounts.all.length === 0 && settings.data?.cutoverDate !== null}
			<section
				class="flex max-w-2xl flex-col items-start gap-3 rounded-lg border border-dashed border-input p-6"
			>
				<p class="font-bold">Nothing to budget yet</p>
				<p class="text-muted-foreground">
					Add an Account with its current balance, or connect a bank from the <a
						href={resolve('/bank')}
						class="underline underline-offset-4 hover:no-underline">Bank</a
					> page.
				</p>
				<Button onclick={() => (addAccountOpen = true)}>
					<PlusIcon aria-hidden="true" />
					Add Account
				</Button>
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
				{#if groupsACategoryCanJoin.length > 0}
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
				<Button variant="ghost" size="sm" href={resolve('/categories')}>Manage Categories</Button>
			</div>
			{#if view.groups.length > 0}
				<div class="lg:flex lg:items-start lg:gap-8" aria-busy={budget.stale}>
					<div class={['min-w-0 flex-1', budget.stale && 'opacity-60']} inert={budget.stale}>
						<BudgetTable groups={view.groups} selectedId={selected?.id ?? null} onselect={select} />
					</div>
					{#if wide.current}
						<aside
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
										<p class="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
											Select a Category to see its Target, move money or cover overspending here.
										</p>
										<UpcomingList upcoming={view.upcoming} />
									{/if}
								</div>
							</ScrollArea>
						</aside>
					{/if}
				</div>
				{#if !wide.current}
					<UpcomingList upcoming={view.upcoming} />
				{/if}
			{:else if view.hidden.length === 0}
				<p class="text-muted-foreground">
					No Categories yet. Add a Category Group, then Categories to assign money to.
				</p>
			{:else if view.upcoming.length > 0}
				<UpcomingList upcoming={view.upcoming} />
			{/if}
		</section>

		{#if view.hidden.length > 0}
			<section aria-labelledby="hidden-heading" class="flex flex-col gap-2">
				<h2 id="hidden-heading" class="text-lg font-bold">Hidden Categories</h2>
				<ul class="flex max-w-md flex-col divide-y rounded-lg border bg-card">
					{#each view.hidden as category (category.id)}
						<li class="flex justify-between gap-4 px-4 py-2">
							<span class="truncate">{category.name}</span>
							<span class={['shrink-0', category.available < 0 && 'text-destructive']}>
								<span class="sr-only">{category.available < 0 ? 'Overspent' : 'Available'}</span>
								{formatCents(category.available)}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
{/if}

{#snippet editCategoriesMenu()}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button variant="ghost" size="icon" aria-label="Edit Categories" {...props}>
					<PencilIcon aria-hidden="true" />
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
			{#if groupsACategoryCanJoin.length > 0}
				<DropdownMenu.Item
					disabled={addDialog?.saving() === true && adding !== 'category'}
					onSelect={() => {
						add('category');
					}}
				>
					Add Category
				</DropdownMenu.Item>
			{/if}
			<DropdownMenu.Item
				onSelect={() => {
					void goto(resolve('/categories'));
				}}
			>
				Manage Categories
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
			aria-labelledby="inspector-heading"
			onOpenAutoFocus={(event: Event) => {
				event.preventDefault();
				document.getElementById('category-inspector')?.focus({ preventScroll: true });
			}}
			onCloseAutoFocus={(event: Event) => {
				event.preventDefault();
			}}
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
