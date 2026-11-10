<script lang="ts">
	import { Popover } from 'bits-ui';
	import { tick } from 'svelte';

	import { attempt } from '$lib/attempt';
	import { Input } from '$lib/components/ui/input';
	import { formatCents, parseAssigned } from '$lib/domain/money';

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
	let hint = $state('');
	let sent: number | null = $state(null);
	let input: HTMLInputElement | null = $state(null);
	let focused = $state(false);
	let hovered = $state(false);
	const errorId = $props.id();

	const read = () => draft ?? shown(sent ?? amount);
	const write = (typed: string) => {
		draft = typed;
	};

	function start(event: FocusEvent) {
		focused = true;
		if (error === '') draft = shown(amount);
		(event.currentTarget as HTMLInputElement).select();
	}

	async function save(cents: number) {
		if (cents === amount) return;
		sent = cents;
		const saved = await attempt(() => onsave(cents));
		sent = null;
		if (!saved.ok) {
			error = "Budge couldn't save Assigned. Try again.";
			hint = "Couldn't save. Try again.";
		}
	}

	function settle(): number | undefined {
		if (draft === null) return undefined;
		const cents = parseAssigned(draft, amount);
		if (cents === undefined) {
			error =
				'Enter an amount, such as 120.00, 100+20, or +5 to add. Escape puts back the saved amount.';
			hint = 'Try 120.00, 100+20 or +5. Esc restores.';
			return undefined;
		}
		error = '';
		hint = '';
		void save(cents);
		return cents;
	}

	function commit() {
		focused = false;
		if (settle() !== undefined) draft = null;
	}

	async function reselect(target: HTMLInputElement) {
		await tick();
		target.select();
	}

	function following(target: HTMLInputElement, step: 1 | -1, scope: ParentNode | null) {
		if (scope === null) return undefined;
		const all = [...scope.querySelectorAll<HTMLInputElement>('input[data-assigned]')].filter(
			(other) => other.checkVisibility()
		);
		const index = all.indexOf(target) + step;
		return index < 0 ? undefined : all[index];
	}

	function keydown(event: KeyboardEvent) {
		const target = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			const cents = settle();
			if (cents === undefined) {
				void reselect(target);
				return;
			}
			const next = following(target, 1, target.closest('table'));
			if (next === undefined) {
				draft = shown(cents);
				void reselect(target);
				return;
			}
			draft = null;
			next.focus();
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			const next = following(target, event.key === 'ArrowDown' ? 1 : -1, document);
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
			hint = '';
			draft = shown(amount);
			void reselect(target);
		}
	}
</script>

<div
	class="ml-auto w-24 *:text-right *:tabular-nums sm:w-28"
	role="presentation"
	onpointerenter={() => (hovered = true)}
	onpointerleave={() => (hovered = false)}
>
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
		aria-keyshortcuts="ArrowUp ArrowDown"
		data-assigned
	/>
	{#if error}<span id={errorId} role="alert" class="sr-only">{error}</span>{/if}
	<Popover.Root open={error !== '' && (focused || hovered)}>
		<Popover.Portal>
			<Popover.Content
				customAnchor={input}
				side="bottom"
				align="end"
				sideOffset={4}
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
				class="z-50 w-44 rounded-md border border-destructive bg-popover px-2.5 py-1.5 text-xs text-destructive shadow-md"
			>
				<span aria-hidden="true">{hint}</span>
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
</div>
