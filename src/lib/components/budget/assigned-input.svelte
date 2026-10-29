<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { formatCents, parseCents } from '$lib/domain/money';

	let {
		amount,
		label,
		onsave
	}: {
		/** The stored Assigned, in cents. */
		amount: number;
		/** The accessible name, such as "Assigned for Groceries". */
		label: string;
		/** Saves the new Assigned; rejects when it couldn't. */
		onsave: (cents: number) => Promise<void>;
	} = $props();

	const shown = (cents: number) => formatCents(cents).replace('$', '');

	let text = $state('');
	let editing = $state(false);
	let error = $state('');
	// Live updates show through, except while the owner is typing.
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
		try {
			await onsave(cents);
		} catch {
			error = "Budge couldn't save Assigned. Try again.";
		}
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

<div class="ml-auto w-28">
	<Input
		bind:value={read, write}
		onfocus={start}
		onblur={commit}
		onkeydown={keydown}
		aria-label={label}
		aria-invalid={error ? true : undefined}
		inputmode="decimal"
		autocomplete="off"
	/>
	{#if error}
		<span role="alert" class="mt-1 block text-xs whitespace-normal text-destructive">{error}</span>
	{/if}
</div>
