<script lang="ts">
	import { useMutation, useQuery } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { formatDate, localIsoDate } from '$lib/domain/dates';
	import { readPublicError } from '$lib/publicError';

	const settings = useQuery(api.settings.get, {});
	const setCutoverDate = useMutation(api.settings.setCutoverDate);

	const cutoverDate = $derived(settings.data?.cutoverDate ?? null);
	let changing = $state(false);
	let date = $state(localIsoDate(new Date()));
	let error = $state('');
	let saving = $state(false);

	function startChange() {
		if (cutoverDate !== null) date = cutoverDate;
		error = '';
		changing = true;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		try {
			await setCutoverDate({ cutoverDate: date });
			changing = false;
		} catch (thrown) {
			error = readPublicError(thrown)?.message ?? "Budge couldn't save the date. Try again.";
		} finally {
			saving = false;
		}
	}
</script>

<section aria-labelledby="cutover-heading" class="flex flex-col gap-2">
	<h2 id="cutover-heading" class="font-medium">Cutover date</h2>
	{#if settings.isLoading}
		<p class="text-muted-foreground">Loading…</p>
	{:else if changing || cutoverDate === null}
		<p class="text-sm text-muted-foreground">
			Budge tracks money from this date on. Starting balances are dated on it.
		</p>
		<form class="flex flex-wrap items-end gap-2" onsubmit={submit}>
			<div class="flex flex-col gap-2">
				<Label for="cutover-date">Date</Label>
				<Input id="cutover-date" type="date" bind:value={date} required />
			</div>
			<Button type="submit" disabled={saving}>Save</Button>
			{#if cutoverDate !== null}
				<Button type="button" variant="ghost" onclick={() => (changing = false)}>Cancel</Button>
			{/if}
		</form>
		{#if error}
			<p role="alert" class="text-sm text-destructive">{error}</p>
		{/if}
	{:else}
		<p class="flex flex-wrap items-center gap-2">
			<span>Budge starts on <time datetime={cutoverDate}>{formatDate(cutoverDate)}</time>.</span>
			<Button variant="outline" size="sm" onclick={startChange}>Change</Button>
		</p>
	{/if}
</section>
