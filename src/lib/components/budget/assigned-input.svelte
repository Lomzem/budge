<script lang="ts">
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

	async function commit() {
		if (!editing) return;
		editing = false;
		const cents = parseCents(text);
		if (cents === undefined) {
			error = 'Enter an amount, such as 120.00.';
			return;
		}
		if (cents === amount) return;
		const saved = await attempt(() => onsave(cents));
		if (!saved.ok) error = "Budge couldn't save Assigned. Try again.";
	}

	function keydown(event: KeyboardEvent) {
		const input = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') input.blur();
		if (event.key === 'Escape') {
			editing = false;
			error = '';
			input.blur();
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
