<script lang="ts">
	import { useMutation, useQuery } from 'convex-svelte';
	import { tick } from 'svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { attempt } from '$lib/attempt';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { dayOfMonth, formatDate, localToday, monthOf } from '$lib/domain/dates';

	import LaterCutoverDialog from './later-cutover-dialog.svelte';

	const settings = useQuery(api.settings.get, {});
	const setCutoverDate = useMutation(api.settings.setCutoverDate);
	const lastMove = useQuery(api.settings.lastMove, {});
	const undoLaterCutover = useMutation(api.settings.undoLaterCutover);
	const undoable = $derived.by(() => {
		const move = lastMove.data ?? null;
		return move !== null && move.to === cutoverDate ? move : null;
	});

	const cutoverDate = $derived(settings.data?.cutoverDate ?? null);
	let changing = $state(false);
	let date = $state(dayOfMonth(monthOf(localToday()), 1));
	let error = $state('');
	let saving = $state(false);
	let undoing = $state(false);
	let previewing = $state(false);
	let undone = $state('');
	let dateInput: HTMLInputElement | null = $state(null);
	let changeButton: HTMLElement | null = $state(null);
	let preview: { open: (from: string, to: string) => void } | undefined = $state();

	async function startChange() {
		if (cutoverDate !== null) date = cutoverDate;
		error = '';
		undone = '';
		changing = true;
		await tick();
		dateInput?.focus();
	}

	async function stopChange() {
		changing = false;
		await tick();
		changeButton?.focus();
	}

	async function undoMove(moveId: Id<'cutoverMoves'>, from: string) {
		undoing = true;
		error = '';
		undone = '';
		const result = await attempt(() => undoLaterCutover({ moveId }));
		undoing = false;
		if (!result.ok) {
			error = result.error?.message ?? "Budge couldn't undo the move. Try again.";
			return;
		}
		undone = `The start date is back on ${formatDate(from)}, with its history.`;
		await tick();
		changeButton?.focus();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (cutoverDate !== null && date > cutoverDate) {
			error = '';
			previewing = true;
			preview?.open(cutoverDate, date);
			return;
		}
		saving = true;
		error = '';
		const saved = await attempt(() => setCutoverDate({ cutoverDate: date }));
		saving = false;
		if (saved.ok) await stopChange();
		else error = saved.error?.message ?? "Budge couldn't save the date. Try again.";
	}
</script>

<section aria-labelledby="cutover-heading" class="flex flex-col gap-3">
	<div class="flex flex-col gap-1">
		<h2 id="cutover-heading" class="text-lg font-bold">Cutover date</h2>
		<p class="text-muted-foreground">
			Budge tracks money from this date on. Bank transactions dated earlier aren't brought in, and
			each Account's starting balance is its balance on this date.
		</p>
	</div>
	{#if settings.error}
		<p role="alert" class="flex h-9 items-center text-destructive">
			Budge couldn't load the cutover date. Try reloading the page.
		</p>
	{:else if settings.data === undefined || (lastMove.data === undefined && !lastMove.error)}
		<p role="status" class="h-9 text-muted-foreground">Loading…</p>
	{:else if changing || cutoverDate === null}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<form
			class="flex flex-wrap items-center gap-2"
			onsubmit={submit}
			onkeydown={(event) => {
				if (event.key !== 'Escape' || cutoverDate === null || previewing) return;
				event.preventDefault();
				error = '';
				void stopChange();
			}}
		>
			<div class="w-44">
				<Input
					id="cutover-date"
					type="date"
					aria-label="Cutover date"
					bind:ref={dateInput}
					bind:value={date}
					required
				/>
			</div>
			<div class="grid min-w-20">
				<Button type="submit" disabled={saving}>Save</Button>
			</div>
			{#if cutoverDate !== null}
				<Button type="button" variant="ghost" onclick={stopChange}>Cancel</Button>
			{/if}
		</form>
	{:else}
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
			<p class="flex min-h-9 items-center">
				<span
					>{undoable === null ? 'Budge starts' : 'Starts'} on
					<time datetime={cutoverDate} class="font-bold">{formatDate(cutoverDate)}</time
					>{#if undoable !== null}<span class="text-muted-foreground"
							>, moved from <time datetime={undoable.from}>{formatDate(undoable.from)}</time></span
						>{/if}.</span
				>
			</p>
			<div class="flex flex-wrap gap-2">
				<Button variant="outline" bind:ref={changeButton} onclick={startChange}>Change</Button>
				{#if undoable !== null}
					{@const move = undoable}
					<Button
						variant="outline"
						aria-describedby="undo-move-detail"
						disabled={undoing}
						onclick={() => undoMove(move.moveId, move.from)}>Undo move</Button
					>
					<span id="undo-move-detail" class="sr-only">
						Puts the start date back on {formatDate(move.from)}, with the Transactions before {formatDate(
							move.to
						)} back in their Accounts.
					</span>
				{/if}
			</div>
		</div>
		<p role="status" class="sr-only">{undone}</p>
	{/if}
	<p role="alert" class={['text-sm text-destructive', error === '' && '-mt-3']}>{error}</p>
</section>

<LaterCutoverDialog
	bind:this={preview}
	onmoved={() => {
		changing = false;
	}}
	onclosed={async () => {
		previewing = false;
		await tick();
		(changing ? dateInput : changeButton)?.focus();
	}}
/>
