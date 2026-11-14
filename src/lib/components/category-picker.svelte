<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';

	import RememberChoice from './remember-choice.svelte';

	import { matchingChoices, type Choice, type Choices } from './choices';

	let {
		value = $bindable(''),
		choices,
		placeholder = '',
		shown,
		disabled = false,
		required = false,
		inline = false,
		searchLabel = 'Search Categories',
		remember,
		onValueChange,
		...trigger
	}: {
		id?: string;
		'aria-label'?: string;
		'aria-invalid'?: boolean | undefined;
		'aria-describedby'?: string | undefined;
		[data: `data-${string}`]: string | undefined;
		value?: string;
		choices: Choices;
		placeholder?: string;
		shown?: string | undefined;
		disabled?: boolean;
		required?: boolean;
		inline?: boolean;
		searchLabel?: string;
		remember?:
			| {
					readonly label: string;
					readonly hint: string;
					readonly accepts: (value: string) => boolean;
			  }
			| undefined;
		onValueChange?: (value: string, remember: boolean) => void;
	} = $props();

	let open = $state(false);
	let search = $state('');
	let highlighted = $state('');
	let searchField = $state<HTMLInputElement | null>(null);
	let list = $state<HTMLElement | null>(null);
	let remembering = $state(false);

	const flat = $derived(choices.flatMap((entry) => ('group' in entry ? entry.choices : [entry])));
	const chosen = $derived(flat.find((choice) => choice.value === value));
	const matches = $derived(matchingChoices(choices, search));

	const key = (choice: string) => `choice:${choice}`;

	let clearOfTabBar = $state(8);

	function show(seed: string) {
		const tabBar = parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom);
		clearOfTabBar = 8 + (Number.isFinite(tabBar) ? tabBar : 0);
		search = seed;
		remembering = false;
		highlighted = seed === '' && chosen ? key(chosen.value) : '';
		open = true;
	}

	function openFromKey(event: KeyboardEvent) {
		if (open || disabled || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			show('');
		} else if (event.key.length === 1 && event.key !== ' ') {
			event.preventDefault();
			show(event.key);
		}
	}

	function centerTheChosen() {
		const viewport = list?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
		const item = list?.querySelector<HTMLElement>('[data-slot="command-item"][data-checked]');
		if (!viewport || !item) return;
		const offset = item.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
		viewport.scrollTop += offset - (viewport.clientHeight - item.offsetHeight) / 2;
	}

	function focusOnOpen(event: Event) {
		event.preventDefault();
		centerTheChosen();
		const touch = matchMedia('(pointer: coarse)').matches;
		if (touch && search === '') {
			list?.closest<HTMLElement>('[data-slot="command"]')?.focus({ preventScroll: true });
			return;
		}
		searchField?.focus({ preventScroll: true });
		searchField?.setSelectionRange(search.length, search.length);
	}

	function searchFromList(event: KeyboardEvent) {
		if (event.target === searchField || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.key.length !== 1 || event.key === ' ') return;
		event.preventDefault();
		search += event.key;
		searchField?.focus();
	}

	function pick(choice: string) {
		value = choice;
		open = false;
		onValueChange?.(choice, remember !== undefined && remembering);
	}
</script>

{#snippet item(choice: Choice)}
	<Command.Item
		value={key(choice.value)}
		disabled={(choice.disabled ?? false) ||
			(remembering && remember?.accepts(choice.value) === false)}
		checked={choice.value === value}
		onSelect={() => {
			pick(choice.value);
		}}
	>
		{choice.label}
	</Command.Item>
{/snippet}

<Popover.Root
	bind:open
	onOpenChange={(next) => {
		if (next) show('');
	}}
>
	<Popover.Trigger
		{...trigger}
		{disabled}
		aria-required={required}
		data-placeholder={chosen === undefined && shown === undefined ? '' : undefined}
		onkeydown={openFromKey}
		variant={inline ? 'inline' : 'field'}
	>
		<span class={inline ? 'min-w-0 break-words' : 'min-w-0 truncate'}>
			{shown ?? chosen?.label ?? placeholder}
		</span>
		<ChevronDownIcon
			aria-hidden="true"
			class={['shrink-0 text-muted-foreground', inline ? 'size-3' : 'size-4']}
		/>
	</Popover.Trigger>
	<Popover.Content
		collisionPadding={{ top: 8, right: 8, left: 8, bottom: clearOfTabBar }}
		onOpenAutoFocus={focusOnOpen}
	>
		<Command.Root
			shouldFilter={false}
			loop
			disableInitialScroll
			bind:value={highlighted}
			onkeydown={searchFromList}
		>
			<Command.Input
				bind:ref={searchField}
				bind:value={search}
				aria-label={searchLabel}
				placeholder="Search"
			/>
			<Command.List bind:ref={list} aria-label="Choices">
				{#each matches as entry, index (index)}
					{#if 'group' in entry}
						<Command.Group heading={entry.group}>
							{#each entry.choices as choice (choice.value)}
								{@render item(choice)}
							{/each}
						</Command.Group>
					{:else}
						{@render item(entry)}
					{/if}
				{/each}
			</Command.List>
			{#if matches.length === 0}
				<p class="px-3 py-6 text-center text-sm text-muted-foreground">
					Nothing matches “{search.trim()}”.
				</p>
			{/if}
		</Command.Root>
		{#if remember}
			<div class="shrink-0 border-t px-3 py-2">
				<RememberChoice bind:checked={remembering} label={remember.label} hint={remember.hint} />
			</div>
		{/if}
	</Popover.Content>
</Popover.Root>
