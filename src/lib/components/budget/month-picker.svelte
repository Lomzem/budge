<script lang="ts">
	import { tick } from 'svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	import { getBudgetMonth } from '$lib/budget.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import { formatMonth, monthOf } from '$lib/domain/dates';

	const budget = getBudgetMonth();

	const names = Array.from({ length: 12 }, (_, index) =>
		new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(
			new Date(Date.UTC(2000, index, 1))
		)
	);

	let open = $state(false);
	let year = $state(Number(budget.month.slice(0, 4)));
	let grid = $state<HTMLElement | null>(null);
	let trigger = $state<HTMLElement | null>(null);

	const monthIn = (shownYear: number, index: number) =>
		`${String(shownYear)}-${String(index + 1).padStart(2, '0')}`;
	const firstYear = $derived(
		budget.firstMonth === null ? undefined : Number(budget.firstMonth.slice(0, 4))
	);
	const before = (month: string) => budget.firstMonth !== null && month < budget.firstMonth;
	const thisMonth = $derived(monthOf(budget.today));

	function variantOf(month: string) {
		if (month === budget.month) return 'default';
		return month === thisMonth ? 'outline' : 'ghost';
	}

	function pick(month: string) {
		budget.goTo(month);
		open = false;
	}

	function returnFocusOnceClosed(event: Event) {
		event.preventDefault();
		if (!open) trigger?.focus({ preventScroll: true });
	}

	function focusChosen(event: Event) {
		event.preventDefault();
		void tick().then(() => {
			if (grid === null || grid.contains(document.activeElement)) return;
			const buttons = grid.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
			const chosen = [...buttons].find((button) => button.hasAttribute('aria-current'));
			(chosen ?? buttons[0])?.focus();
		});
	}

	function arrows(event: KeyboardEvent) {
		const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
		if (step === undefined || grid === null) return;
		const buttons = [...grid.querySelectorAll<HTMLButtonElement>('button')];
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next = buttons[at + step];
		if (at === -1 || next === undefined || next.disabled) return;
		event.preventDefault();
		next.focus();
	}
</script>

<Popover.Root
	bind:open
	onOpenChange={(next) => {
		if (next) year = Number(budget.month.slice(0, 4));
	}}
>
	<Popover.Trigger
		bind:ref={trigger}
		variant="inline"
		aria-label="{formatMonth(budget.month)}, choose a month"
	>
		<span>{formatMonth(budget.month)}</span>
		<ChevronDownIcon aria-hidden="true" class="size-4 text-muted-foreground" />
	</Popover.Trigger>
	<Popover.Content
		align="center"
		onOpenAutoFocus={focusChosen}
		onCloseAutoFocus={returnFocusOnceClosed}
	>
		<div class="flex flex-col p-3">
			<div class="flex items-center justify-between pb-2">
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Previous year"
					disabled={firstYear !== undefined && year <= firstYear}
					onclick={() => (year -= 1)}
				>
					<ChevronLeftIcon />
				</Button>
				<p class="font-bold tabular-nums" aria-live="polite">{year}</p>
				<Button variant="ghost" size="icon-sm" aria-label="Next year" onclick={() => (year += 1)}>
					<ChevronRightIcon />
				</Button>
			</div>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				bind:this={grid}
				class="grid grid-cols-3 gap-1"
				role="group"
				aria-label={String(year)}
				onkeydown={arrows}
			>
				{#each names as name, index (name)}
					{@const month = monthIn(year, index)}
					<Button
						variant={variantOf(month)}
						size="sm"
						aria-label={formatMonth(month)}
						aria-current={month === budget.month ? 'date' : undefined}
						disabled={before(month)}
						onclick={() => {
							pick(month);
						}}
					>
						{name}
					</Button>
				{/each}
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
