<script lang="ts">
	import { useMutation, useQuery } from 'convex-svelte';
	import { tick } from 'svelte';

	import { api } from '$convex/_generated/api';
	import { attempt } from '$lib/attempt';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { formatDate, localIsoDate } from '$lib/domain/dates';

	const settings = useQuery(api.settings.get, {});
	const setCutoverDate = useMutation(api.settings.setCutoverDate);

	const cutoverDate = $derived(settings.data?.cutoverDate ?? null);
	let changing = $state(false);
	let date = $state(localIsoDate(new Date()));
	let error = $state('');
	let saving = $state(false);
	let dateInput: HTMLInputElement | null = $state(null);
	let changeButton: HTMLElement | null = $state(null);

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
			Budge tracks money from this date on. Starting balances are dated on it.
		</p>
	</div>
	{#if settings.data === undefined}
		<p role="status" class="h-9 text-muted-foreground">Loading…</p>
	{:else if changing || cutoverDate === null}
		<form class="flex flex-wrap items-center gap-2" onsubmit={submit}>
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
			<p class="flex h-9 items-center">
				<span
					>Budge starts on <time datetime={cutoverDate} class="font-bold"
						>{formatDate(cutoverDate)}</time
					>.</span
				>
			</p>
			<Button variant="outline" bind:ref={changeButton} onclick={startChange}>Change</Button>
		</div>
	{/if}
	<p role="alert" class={['text-sm text-destructive', error === '' && '-mt-3']}>{error}</p>
</section>
