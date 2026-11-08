<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import { getBudgetMonth } from '$lib/budget.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import { isRepeatInterval, MAX_REPEAT_MONTHS } from '$lib/domain/budget';
	import { isIsoDate, ordinal } from '$lib/domain/dates';
	import { formatCents, parseCents } from '$lib/domain/money';

	import type { TargetDefinition } from './status';

	let {
		open = $bindable(false),
		category
	}: {
		open?: boolean;

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
	const dialog = new DialogSession();

	export function reset() {
		dialog.open({});
		const target = category.target;
		kind = target?.kind ?? 'monthly';
		amount = target === null ? '' : formatCents(target.amount).replace('$', '');
		mode = target?.kind === 'monthly' ? target.mode : 'refill';
		const due = target?.kind === 'monthly' ? target.dueDay : undefined;
		dueDay = due === undefined ? '' : String(due);
		date = target?.kind === 'byDate' ? target.firstDate : '';
		const every = target?.kind === 'byDate' ? target.everyMonths : undefined;
		repeats = every !== undefined;
		everyMonths = every === undefined ? '12' : String(every);
		error = '';
	}

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
		if (!isRepeatInterval(every)) return `Repeat every 1 to ${String(MAX_REPEAT_MONTHS)} months.`;
		return { kind, amount: cents, firstDate: date, everyMonths: every };
	}

	async function save(target: TargetDefinition | null) {
		const saved = await dialog.run('save', () => budget.setTarget(category.id, target));
		if (saved.ok) open = false;
		else error = saved.error?.message ?? "Budge couldn't save the Target. Try again.";
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
						class="h-9 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-base md:text-sm pointer-coarse:h-11"
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

			<p role="alert" class="min-h-6 text-sm text-destructive">{error}</p>
			<Dialog.Footer>
				{#if category.target}
					<Button
						type="button"
						variant="outline"
						disabled={dialog.pending('save')}
						onclick={() => {
							error = '';
							void save(null);
						}}>Remove Target</Button
					>
				{/if}
				<Button type="submit" disabled={dialog.pending('save')}>Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
