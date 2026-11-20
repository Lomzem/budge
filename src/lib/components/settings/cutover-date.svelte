<script lang="ts">
	import { useMutation } from 'convex-svelte';
	import { tick } from 'svelte';

	import { api } from '$convex/_generated/api';
	import { getShellQueries } from '$lib/shellQueries.svelte';
	import { attempt } from '$lib/attempt';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { dayOfMonth, formatDate, localToday, monthOf } from '$lib/domain/dates';
	import { mainRegion } from '$lib/focusReturn';

	import LaterCutoverDialog from './later-cutover-dialog.svelte';

	const { settings } = getShellQueries();
	const setCutoverDate = useMutation(api.settings.setCutoverDate);

	const cutoverDate = $derived(settings.data?.cutoverDate ?? null);
	let changing = $state(false);
	let date = $state(dayOfMonth(monthOf(localToday()), 1));
	let error = $state('');
	let saving = $state(false);
	let dateInput: HTMLInputElement | null = $state(null);
	let changeButton: HTMLElement | null = $state(null);
	let preview: { open: (from: string, to: string) => void; isOpen: () => boolean } | undefined =
		$state();

	async function startChange() {
		if (cutoverDate !== null) date = cutoverDate;
		error = '';
		changing = true;
		await tick();
		dateInput?.focus();
	}

	async function stopChange() {
		changing = false;
		await tick();
		changeButton?.focus();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (cutoverDate !== null && date > cutoverDate) {
			error = '';
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
	<h2 id="cutover-heading" class="text-lg font-bold">Cutover date</h2>
	{#if changing || cutoverDate === null}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<form
			class="flex flex-wrap items-center gap-2"
			onsubmit={submit}
			onkeydown={(event) => {
				if (event.key !== 'Escape' || cutoverDate === null || preview?.isOpen() === true) return;
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
			<time datetime={cutoverDate} class="flex min-h-9 items-center font-bold"
				>{formatDate(cutoverDate)}</time
			>
			<Button variant="outline" bind:ref={changeButton} onclick={startChange}>Change</Button>
		</div>
	{/if}
	<p role="alert" class={['text-sm text-destructive', error === '' && '-mt-3']}>{error}</p>
</section>

<LaterCutoverDialog
	bind:this={preview}
	onmoved={() => {
		changing = false;
	}}
	returnFocus={{
		opener: () => dateInput,
		continuation: () => changeButton,
		fallback: mainRegion
	}}
/>
