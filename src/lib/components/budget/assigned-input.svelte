<script lang="ts">
	import { tick } from 'svelte';

	import { attempt } from '$lib/attempt';
	import { Input } from '$lib/components/ui/input';
	import { formatCents, parseCents } from '$lib/domain/money';

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

	let text = $state('');
	let editing = $state(false);
	let error = $state('');
	const errorId = $props.id();

	const read = () => (editing ? text : shown(amount));
	const write = (typed: string) => {
		text = typed;
	};

	function start(event: FocusEvent) {
		text = shown(amount);
		editing = true;
		error = '';
		(event.currentTarget as HTMLInputElement).select();
	}

	async function save(typed: string) {
		const cents = parseCents(typed);
		if (cents === undefined) {
			error = 'Enter an amount, such as 120.00.';
			return;
		}
		if (cents === amount) return;
		const saved = await attempt(() => onsave(cents));
		if (!saved.ok) error = "Budge couldn't save Assigned. Try again.";
	}

	async function commit() {
		if (!editing) return;
		editing = false;
		await save(text);
	}

	async function restart(input: HTMLInputElement, next: string) {
		text = next;
		await tick();
		input.select();
	}

	function keydown(event: KeyboardEvent) {
		const input = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			error = '';
			const typed = text;
			const cents = parseCents(typed);
			void save(typed);
			void restart(input, cents === undefined ? typed : shown(cents));
		}
		if (event.key === 'Escape') {
			error = '';
			void restart(input, shown(amount));
		}
	}
</script>

<div class="relative ml-auto w-24 sm:w-28">
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
	/>
	<span
		id={errorId}
		role="alert"
		class={[
			'absolute top-full right-0 z-20 mt-1 w-56 rounded-md border border-destructive bg-popover px-3 py-2 text-left text-xs whitespace-normal text-destructive shadow-md',
			!error && 'hidden'
		]}>{error}</span
	>
</div>
