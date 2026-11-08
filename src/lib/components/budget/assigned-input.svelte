<script lang="ts">
	import { Popover } from 'bits-ui';
	import { tick } from 'svelte';

	import { attempt } from '$lib/attempt';
	import { Input } from '$lib/components/ui/input';
	import { formatCents, parseCentsSum } from '$lib/domain/money';

	let {
		amount,
		label,
		onsave
	}: {
		amount: number;

		label: string;

		onsave: (cents: number) => Promise<void>;
	} = $props();

	const shown = (cents: number) => formatCents(cents).replace('$', '');

	let draft: string | null = $state(null);
	let error = $state('');
	let input: HTMLInputElement | null = $state(null);
	const errorId = $props.id();

	const read = () => draft ?? shown(amount);
	const write = (typed: string) => {
		draft = typed;
	};

	function start(event: FocusEvent) {
		if (error === '') draft = shown(amount);
		(event.currentTarget as HTMLInputElement).select();
	}

	async function save(cents: number) {
		if (cents === amount) return;
		const saved = await attempt(() => onsave(cents));
		if (!saved.ok) error = "Budge couldn't save Assigned. Try again.";
	}

	function settle(): number | undefined {
		if (draft === null) return undefined;
		const cents = parseCentsSum(draft);
		if (cents === undefined) {
			error = 'Enter an amount, such as 120.00 or 100+20. Escape puts back the saved amount.';
			return undefined;
		}
		error = '';
		void save(cents);
		return cents;
	}

	function commit() {
		if (settle() !== undefined) draft = null;
	}

	async function reselect(target: HTMLInputElement) {
		await tick();
		target.select();
	}

	function keydown(event: KeyboardEvent) {
		const target = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			const cents = settle();
			if (cents !== undefined) draft = shown(cents);
			void reselect(target);
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			const all = [...document.querySelectorAll<HTMLInputElement>('input[data-assigned]')].filter(
				(other) => other.checkVisibility()
			);
			const next = all[all.indexOf(target) + (event.key === 'ArrowDown' ? 1 : -1)];
			if (next === undefined) return;
			event.preventDefault();
			if (draft !== null) {
				if (settle() === undefined) return;
				draft = null;
			}
			next.focus();
		}
		if (event.key === 'Escape' && (error !== '' || draft !== shown(amount))) {
			event.stopPropagation();
			error = '';
			draft = shown(amount);
			void reselect(target);
		}
	}
</script>

<div class="ml-auto w-24 sm:w-28">
	<Input
		bind:ref={input}
		bind:value={read, write}
		onfocus={start}
		onblur={commit}
		onkeydown={keydown}
		aria-label={label}
		aria-invalid={error ? true : undefined}
		aria-describedby={error ? errorId : undefined}
		inputmode="decimal"
		autocomplete="off"
		data-assigned
	/>
	<Popover.Root open={error !== ''}>
		<Popover.Portal>
			<Popover.Content
				customAnchor={input}
				side="bottom"
				align="end"
				sideOffset={6}
				collisionPadding={8}
				trapFocus={false}
				interactOutsideBehavior="ignore"
				escapeKeydownBehavior="ignore"
				onOpenAutoFocus={(event: Event) => {
					event.preventDefault();
				}}
				onCloseAutoFocus={(event: Event) => {
					event.preventDefault();
				}}
				class="z-50 w-60 rounded-md border border-destructive bg-popover px-3 py-2 text-xs text-destructive shadow-md"
			>
				<span id={errorId} role="alert">{error}</span>
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
</div>
