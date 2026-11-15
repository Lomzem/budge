<script lang="ts">
	import { tick, untrack, type Snippet } from 'svelte';
	import { on } from 'svelte/events';

	import { attempt } from '$lib/attempt';
	import { Input } from '$lib/components/ui/input';
	import { keepReasonInView, keepRefusalInView } from '$lib/refusalInView';

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
	let failed: { name: string; error: string } | null = $state(null);
	let latest = 0;
	const errorId = $props.id();

	let draftOpened = false;
	let openings = 0;
	$effect.pre(() => {
		const opening = editing && !draftOpened;
		draftOpened = editing;
		if (!opening) return;
		openings++;
		untrack(() => {
			draft = pending ?? failed?.name ?? name;
			error = failed?.error ?? '';
			failed = null;
		});
	});

	let pressing = false;
	$effect(() => {
		if (!editing) return;
		pressing = false;
		const press = (event: PointerEvent) => {
			pressing = event.type === 'pointerdown';
		};
		const stops = (['pointerdown', 'pointerup', 'pointercancel'] as const).map((type) =>
			on(window, type, press, { capture: true })
		);
		return () => {
			for (const stop of stops) stop();
		};
	});

	function decideWhenThePressEnds(decide: () => void) {
		if (!pressing) {
			decide();
			return;
		}
		const ended = new AbortController();
		for (const type of ['pointerup', 'pointercancel'] as const) {
			on(
				window,
				type,
				() => {
					ended.abort();
					decide();
				},
				{ signal: ended.signal }
			);
		}
	}

	async function save(next: string) {
		pending = next;
		const ticket = ++latest;
		const saved = await attempt(() => onsave(next));
		if (ticket !== latest) return;
		pending = null;
		if (saved.ok) return;
		const message = saved.error?.message ?? "Budge couldn't rename it. Try again.";
		if (editing) {
			error = message;
			return;
		}
		failed = { name: next, error: message };
		editing = true;
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
			onblur={(event: FocusEvent & { currentTarget: HTMLInputElement }) => {
				if (!editing) return;
				const input = event.currentTarget;
				const left = openings;
				decideWhenThePressEnds(() =>
					setTimeout(() => {
						if (left !== openings) return;
						if (document.hasFocus() && document.activeElement === input) return;
						commit();
					})
				);
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
		{#if error}<p
				id={errorId}
				role="alert"
				class="mt-1 text-sm text-destructive"
				{@attach keepReasonInView}
			>
				{error}
			</p>{/if}
	</div>
{:else if failed}
	<div class={['flex min-w-0 flex-1 flex-col', className]}>
		{@render children(name)}
		<p role="alert" class="mt-1 text-sm text-destructive" {@attach keepRefusalInView}>
			{failed.error}
		</p>
	</div>
{:else}
	{@render children(pending ?? name)}
{/if}
