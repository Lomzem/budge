<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import { getBudgetMonth } from '$lib/budget.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { isIsoDate, ordinal } from '$lib/domain/dates';
	import { formatCents, parseCents } from '$lib/domain/money';
	import { readPublicError } from '$lib/publicError';

	import type { TargetDefinition } from './status';

	let {
		open = $bindable(false),
		category
	}: {
		open?: boolean;
		/** The Category whose Target the dialog sets, with its Target if it has one. */
		category: { id: Id<'categories'>; name: string; target: TargetDefinition | null };
	} = $props();

	const budget = getBudgetMonth();
	const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

	let kind: 'monthly' | 'byDate' = $state('monthly');
	let amount = $state('');
	let mode: 'refill' | 'setAside' = $state('refill');
	let dueDay = $state('');
	let date = $state('');
	let repeats = $state(false);
	let everyMonths = $state('12');
	let error = $state('');
	let saving = $state(false);

	/** Fills the form from the Category's Target, or a blank one; the parent calls it before each open. */
	export function reset() {
		const target = category.target;
		kind = target?.kind ?? 'monthly';
		amount = target === null ? '' : formatCents(target.amount).replace('$', '');
		mode = target?.kind === 'monthly' ? target.mode : 'refill';
		dueDay = target?.kind === 'monthly' && target.dueDay !== undefined ? String(target.dueDay) : '';
		date = target?.kind === 'byDate' ? target.firstDate : '';
		repeats = target?.kind === 'byDate' && target.everyMonths !== undefined;
		everyMonths =
			target?.kind === 'byDate' && target.everyMonths !== undefined
				? String(target.everyMonths)
				: '12';
		error = '';
	}

	/** The Target the form describes, or a message saying what to fix. */
	function read(): TargetDefinition | string {
		const cents = parseCents(amount);
		if (cents === undefined || cents <= 0) return 'Enter an amount above zero, such as 50.00.';
		if (kind === 'monthly') {
			return dueDay === ''
				? { kind, amount: cents, mode }
				: { kind, amount: cents, mode, dueDay: Number(dueDay) };
		}
		if (!isIsoDate(date)) return 'Pick a date.';
		if (!repeats) return { kind, amount: cents, firstDate: date };
		const every = Number(everyMonths);
		if (!Number.isInteger(every) || every < 1 || every > 120) {
			return 'Repeat every 1 to 120 months.';
		}
		return { kind, amount: cents, firstDate: date, everyMonths: every };
	}

	async function save(target: TargetDefinition | null) {
		saving = true;
		try {
			await budget.setTarget(category.id, target);
			open = false;
		} catch (thrown) {
			error = readPublicError(thrown)?.message ?? "Budge couldn't save the Target. Try again.";
		} finally {
			saving = false;
		}
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		const target = read();
		if (typeof target === 'string') {
			error = target;
			return;
		}
		await save(target);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{category.target ? 'Edit Target' : 'Add Target'}: {category.name}</Dialog.Title>
		</Dialog.Header>
		<form class="flex flex-col gap-4" onsubmit={submit}>
			<fieldset class="flex flex-col gap-2">
				<legend class="mb-2 text-sm font-medium">Kind</legend>
				<RadioGroup.Root bind:value={kind}>
					<div class="flex items-center gap-2">
						<RadioGroup.Item value="monthly" id="target-monthly" />
						<Label for="target-monthly">Monthly</Label>
					</div>
					<div class="flex items-center gap-2">
						<RadioGroup.Item value="byDate" id="target-by-date" />
						<Label for="target-by-date">By date</Label>
					</div>
				</RadioGroup.Root>
			</fieldset>

			<div class="flex flex-col gap-2">
				<Label for="target-amount">Amount</Label>
				<Input
					id="target-amount"
					bind:value={amount}
					inputmode="decimal"
					placeholder="0.00"
					autocomplete="off"
					required
				/>
			</div>

			{#if kind === 'monthly'}
				<fieldset class="flex flex-col gap-2">
					<legend class="mb-2 text-sm font-medium">Each month</legend>
					<RadioGroup.Root bind:value={mode}>
						<div class="flex items-center gap-2">
							<RadioGroup.Item value="refill" id="target-refill" />
							<Label for="target-refill">Refill up to the amount</Label>
						</div>
						<div class="flex items-center gap-2">
							<RadioGroup.Item value="setAside" id="target-set-aside" />
							<Label for="target-set-aside">Set aside the amount</Label>
						</div>
					</RadioGroup.Root>
				</fieldset>
				<div class="flex flex-col gap-2">
					<Label for="target-due-day">Due day</Label>
					<select
						id="target-due-day"
						bind:value={dueDay}
						class="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm"
					>
						<option value="">No due day</option>
						{#each DAYS as day (day)}
							<option value={String(day)}>The {ordinal(day)}</option>
						{/each}
					</select>
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					<Label for="target-date">Available by</Label>
					<Input id="target-date" type="date" bind:value={date} required />
				</div>
				<div class="flex items-center gap-2">
					<Checkbox id="target-repeats" bind:checked={repeats} />
					<Label for="target-repeats">Repeat</Label>
				</div>
				{#if repeats}
					<div class="flex flex-col gap-2">
						<Label for="target-every">Every how many months</Label>
						<Input
							id="target-every"
							bind:value={everyMonths}
							inputmode="numeric"
							autocomplete="off"
							required
						/>
					</div>
				{/if}
			{/if}

			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}
			<Dialog.Footer>
				{#if category.target}
					<Button
						type="button"
						variant="outline"
						disabled={saving}
						onclick={() => {
							error = '';
							void save(null);
						}}>Remove Target</Button
					>
				{/if}
				<Button type="submit" disabled={saving}>Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
