<script lang="ts">
	import type { FunctionArgs } from 'convex/server';
	import { useMutation, useQuery } from 'convex-svelte';
	import { untrack } from 'svelte';

	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getAccounts } from '$lib/accounts.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Table from '$lib/components/ui/table';
	import type { BankFile } from '$lib/domain/bankFiles';
	import { formatDate } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';
	import { readBankFile } from '$lib/import';
	import { readPublicError } from '$lib/publicError';

	type FileRows = FunctionArgs<typeof api.imports.commit>['rows'];

	let {
		open = $bindable(false),
		defaultAccountId
	}: { open?: boolean; defaultAccountId?: Id<'accounts'> | undefined } = $props();

	const accounts = getAccounts();
	const settings = useQuery(api.settings.get, () => (open ? {} : 'skip'));
	const commit = useMutation(api.imports.commit);

	let accountId = $state('');
	let file: BankFile | undefined = $state();
	/** Per row with several candidates: a Transaction ID, `'new'`, or `''` until picked. */
	let picks: string[] = $state([]);
	let reading = $state(false);
	let saving = $state(false);
	let error = $state('');

	const account = $derived(accounts.find(accountId));
	const cutoverDate = $derived(settings.data?.cutoverDate ?? null);
	const preview = useQuery(api.imports.preview, () =>
		open && account && file && file.rows.length > 0
			? { accountId: account._id, source: file.source, rows: file.rows }
			: 'skip'
	);
	const decisions = $derived(preview.data ?? []);
	const counts = $derived({
		new: decisions.filter((row) => row.kind === 'new').length,
		match: decisions.filter((row) => row.kind === 'match').length,
		skip: decisions.filter((row) => row.kind === 'skip').length,
		ask: decisions.filter((row) => row.kind === 'ask').length
	});
	// A pick counts only while it is still one of the row's options; a live update or another
	// Account can take its candidate away.
	const unpicked = $derived(
		decisions.filter((row, index) => {
			if (row.kind !== 'ask') return false;
			const pick = picks[index] ?? '';
			return pick !== 'new' && !row.candidates.some((candidate) => candidate._id === pick);
		}).length
	);
	const ready = $derived(
		preview.data !== undefined &&
			preview.data.length === file?.rows.length &&
			unpicked === 0 &&
			counts.new + counts.match + counts.ask > 0
	);

	// Start over each time the dialog opens.
	$effect(() => {
		if (open) untrack(reset);
	});

	function reset() {
		accountId = defaultAccountId ?? accounts.all[0]?._id ?? '';
		file = undefined;
		picks = [];
		error = '';
	}

	async function choose(event: Event & { currentTarget: HTMLInputElement }) {
		const chosen = event.currentTarget.files?.[0];
		file = undefined;
		picks = [];
		error = '';
		if (chosen === undefined) return;
		if (cutoverDate === null) {
			error = 'Set the cutover date before importing.';
			return;
		}
		reading = true;
		try {
			const result = await readBankFile(chosen, cutoverDate);
			if (result.ok) file = result.file;
			else error = result.message;
		} catch {
			error = "Budge couldn't read this file.";
		} finally {
			reading = false;
		}
	}

	function rowsWithPicks(): FileRows {
		if (!file) return [];
		return file.rows.map((row, index) => {
			const decision = decisions[index];
			const pick = picks[index] ?? '';
			if (decision?.kind !== 'ask' || pick === '') return row;
			if (pick === 'new') return { ...row, pick: 'new' as const };
			const candidate = decision.candidates.find((c) => c._id === pick);
			return candidate ? { ...row, pick: candidate._id } : row;
		});
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!account || !file || !ready) return;
		saving = true;
		error = '';
		try {
			await commit({ accountId: account._id, source: file.source, rows: rowsWithPicks() });
			open = false;
		} catch (thrown) {
			error = readPublicError(thrown)?.message ?? "Budge couldn't save the import. Try again.";
		} finally {
			saving = false;
		}
	}

	function plural(count: number, one: string, many: string) {
		return `${String(count)} ${count === 1 ? one : many}`;
	}

	const summary = $derived(
		[
			plural(counts.new, 'new Transaction', 'new Transactions'),
			plural(counts.match, 'Match', 'Matches'),
			`${plural(counts.skip, 'duplicate', 'duplicates')} skipped`,
			...(counts.ask > 0 ? [`${plural(counts.ask, 'row needs', 'rows need')} a pick`] : [])
		].join(', ') + '.'
	);
</script>

<Dialog.Root bind:open>
	<Dialog.Content size="wide">
		<Dialog.Header>
			<Dialog.Title>Import a bank file</Dialog.Title>
			<Dialog.Description>
				A Capital One CSV or QFX file, or a Discover CSV file. Budge reads it on this device and
				saves only its rows.
			</Dialog.Description>
		</Dialog.Header>
		<form class="flex min-w-0 flex-col gap-4" onsubmit={save}>
			<div class="flex flex-col gap-2">
				<Label for="import-account">Account</Label>
				<select
					id="import-account"
					bind:value={accountId}
					onchange={() => (picks = [])}
					required
					class="h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm"
				>
					{#each accounts.all as option (option._id)}
						<option value={option._id}>{option.name}</option>
					{/each}
				</select>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="import-file">File</Label>
				<Input
					id="import-file"
					type="file"
					accept=".csv,.qfx,.ofx,text/csv"
					onchange={choose}
					disabled={reading || saving}
				/>
			</div>

			{#if reading}
				<p role="status" class="text-muted-foreground">Reading the file…</p>
			{:else if file?.rows.length === 0}
				<p role="status">Nothing in this file is dated on or after the cutover date.</p>
			{:else if file}
				<section aria-labelledby="import-preview-heading" class="flex min-w-0 flex-col gap-2">
					<h3 id="import-preview-heading" class="font-medium">Preview</h3>
					{#if preview.data}
						<p role="status">{summary}</p>
					{:else if preview.error}
						<p role="alert" class="text-destructive">
							{readPublicError(preview.error)?.message ?? "Budge couldn't check these rows."}
						</p>
					{:else}
						<p role="status" class="text-muted-foreground">Checking for Matches…</p>
					{/if}
					<div class="@container max-h-80 overflow-y-auto">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head width="fit">Date</Table.Head>
									<Table.Head width="fill">Bank Text</Table.Head>
									<Table.Head width="fit" align="end">Amount</Table.Head>
									<Table.Head showFrom="lg">On save</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each file.rows as row, index (index)}
									<Table.Row>
										<Table.Cell numeric>
											<time datetime={row.date}>{formatDate(row.date, 'short')}</time>
										</Table.Cell>
										<Table.Cell width="fill">
											<span class="block max-w-full truncate">{row.bankText}</span>
											<span class="block text-xs @lg:hidden">
												{@render outcome(index)}
											</span>
										</Table.Cell>
										<Table.Cell align="end" numeric>{formatCents(row.amount)}</Table.Cell>
										<Table.Cell showFrom="lg">{@render outcome(index)}</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
				</section>
			{/if}

			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={!ready || saving}>
					{saving ? 'Saving…' : 'Save'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

{#snippet outcome(index: number)}
	{@const decision = decisions[index]}
	{#if decision === undefined}
		<span class="text-muted-foreground">…</span>
	{:else if decision.kind === 'new'}
		New
	{:else if decision.kind === 'skip'}
		Duplicate, skipped
	{:else if decision.kind === 'match'}
		<span class="text-xs">
			Matches {decision.transaction.payeeName ?? 'No Payee'}, {formatDate(
				decision.transaction.date,
				'short'
			)}
		</span>
	{:else}
		<label class="flex flex-col gap-1 text-xs">
			<span>Match with</span>
			<select
				bind:value={picks[index]}
				required
				class="h-8 max-w-56 rounded-lg border border-input bg-background px-2 text-base md:text-sm"
			>
				<option value="">Pick one</option>
				{#each decision.candidates as candidate (candidate._id)}
					<option value={candidate._id}>
						{candidate.payeeName ?? 'No Payee'}, {formatDate(
							candidate.date,
							'short'
						)}{candidate.memo ? `, ${candidate.memo}` : ''}
					</option>
				{/each}
				<option value="new">None, add as new</option>
			</select>
		</label>
	{/if}
{/snippet}
