<script lang="ts">
	import { tick, untrack, type Snippet } from 'svelte';

	import { attempt } from '$lib/attempt';
	import { Input } from '$lib/components/ui/input';

	let {
		name,
		label,
		editing = $bindable(false),
		class: className = '',
		onsave,
		onleave,
		children
	}: {
		name: string;

		label: string;
		editing?: boolean;
		class?: string;
		onsave: (name: string) => Promise<unknown>;

		onleave: () => void;
		children: Snippet<[string]>;
	} = $props();

	let draft = $state('');
	let pending: string | null = $state(null);
	let error = $state('');
	let latest = 0;
	const errorId = $props.id();

	let draftOpened = false;
	$effect.pre(() => {
		const opening = editing && !draftOpened;
		draftOpened = editing;
		if (!opening) return;
		untrack(() => {
			draft = pending ?? name;
			error = '';
		});
	});

	async function save(next: string) {
		pending = next;
		const ticket = ++latest;
		const saved = await attempt(() => onsave(next));
		if (ticket !== latest) return;
		pending = null;
		if (saved.ok) return;
		const typingAnotherName = editing;
		editing = true;
		await tick();
		if (!typingAnotherName) draft = next;
		error = saved.error?.message ?? "Budge couldn't rename it. Try again.";
	}

	function commit(): boolean {
		const next = draft.trim();
		if (next === '') {
			error = 'Enter a name.';
			return false;
		}
		editing = false;
		if (next !== (pending ?? name)) void save(next);
		return true;
	}

	async function leave() {
		await tick();
		onleave();
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			if (commit()) void leave();
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			editing = false;
			void leave();
		}
	}
</script>

{#if editing}
	<div class={['min-w-0 flex-1', className]}>
		<Input
			value={draft}
			oninput={(event: Event & { currentTarget: HTMLInputElement }) => {
				draft = event.currentTarget.value;
				error = '';
			}}
			onblur={() => {
				if (!editing) return;
				if (draft.trim() === '') editing = false;
				else commit();
			}}
			onkeydown={keydown}
			aria-label={label}
			aria-invalid={error ? true : undefined}
			aria-describedby={error ? errorId : undefined}
			autocomplete="off"
			{@attach (node: HTMLInputElement) => {
				node.focus();
				node.select();
			}}
		/>
		{#if error}<p id={errorId} role="alert" class="mt-1 text-sm text-destructive">{error}</p>{/if}
	</div>
{:else}
	{@render children(pending ?? name)}
{/if}
