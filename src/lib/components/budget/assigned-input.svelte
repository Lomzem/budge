<script lang="ts">
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
	let edited = $state(false);
	let error = $state('');
	let hint = $state('');
	let sent: number | null = $state(null);
	const errorId = $props.id();

	const read = () => draft ?? shown(sent ?? amount);
	const write = (typed: string) => {
		draft = typed;
		edited = true;
	};
	const display = (cents: number) => {
		draft = shown(cents);
		edited = false;
	};

	function start(event: FocusEvent) {
		if (error === '') display(amount);
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
		if (!edited) return sent ?? amount;
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
				display(cents);
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
		if (event.key === 'Escape' && (error !== '' || edited)) {
			event.stopPropagation();
			error = '';
			hint = '';
			display(amount);
			void reselect(target);
		}
	}
</script>

<div class="ml-auto w-24 *:text-right *:tabular-nums sm:w-28">
	<Input
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
	{#if hint}
		<span
			{@attach (node: HTMLElement) => {
				node.scrollIntoView({ block: 'nearest' });
			}}
			aria-hidden="true"
			class="mt-1 block text-xs whitespace-normal text-destructive">{hint}</span
		>
	{/if}
</div>
