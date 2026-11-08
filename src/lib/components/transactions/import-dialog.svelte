<script lang="ts">
	import type { FunctionArgs, FunctionReturnType } from 'convex/server';
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
	import { DialogSession } from '$lib/dialogSession.svelte';
	import type { BankFile } from '$lib/domain/bankFiles';
	import { formatDate } from '$lib/domain/dates';
	import { formatCents } from '$lib/domain/money';
	import { readBankFile } from '$lib/import';
	import { readPublicError } from '$lib/publicError';

	type FileRows = FunctionArgs<typeof api.imports.commit>['rows'];
	type PreviewCandidate = Extract<
		FunctionReturnType<typeof api.imports.preview>[number],
		{ kind: 'ask' }
	>['candidates'][number];

	let {
		open = $bindable(false),
		defaultAccountId
	}: { open?: boolean; defaultAccountId?: Id<'accounts'> | undefined } = $props();

	const accounts = getAccounts();
	const settings = useQuery(api.settings.get, () => (open ? {} : 'skip'));
	const commit = useMutation(api.imports.commit);

	let accountId = $state('');
	let file: BankFile | undefined = $state();

	let picks: string[] = $state([]);
	let error = $state('');

	const dialog = new DialogSession<object, 'read' | 'save'>();
	const reading = $derived(dialog.pending('read'));
	const saving = $derived(dialog.pending('save'));

	const account = $derived(accounts.find(accountId));
	const cutoverDate = $derived(settings.data?.cutoverDate ?? null);

	const preview = useQuery(
		api.imports.preview,
		() =>
			open && account && file && file.rows.length > 0
				? { accountId: account._id, source: file.source, rows: rowsWithPicks(file) }
				: 'skip',
		{ keepPreviousData: true }
	);
	const decisions = $derived(preview.data ?? []);
	const counts = $derived({
		new: decisions.filter((row) => row.kind === 'new').length,
		match: decisions.filter((row) => row.kind === 'match').length,
		skip: decisions.filter((row) => row.kind === 'skip').length,
		ask: decisions.filter((row) => row.kind === 'ask').length
	});
	const ready = $derived(
		preview.data !== undefined &&
			!preview.isStale &&
			preview.data.length === file?.rows.length &&
			counts.ask === 0 &&
			counts.new + counts.match > 0
	);

	$effect(() => {
		if (open) untrack(reset);
	});

	function reset() {
		dialog.open({});
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
		const opened = await dialog.run('read', () => readBankFile(chosen, cutoverDate));
		if (!opened.ok) error = "Budge couldn't read this file.";
		else if (opened.value.ok) file = opened.value.file;
		else error = opened.value.message;
	}

	function rowsWithPicks({ rows }: BankFile): FileRows {
		return rows.map((row, index) => {
			const pick = picks[index] ?? '';
			if (pick === '') return row;
			return { ...row, pick: pick === 'new' ? 'new' : (pick as Id<'transactions'>) };
		});
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!account || !file || !ready) return;
		error = '';
		const args = { accountId: account._id, source: file.source, rows: rowsWithPicks(file) };
		const committed = await dialog.run('save', () => commit(args));
		if (committed.ok) open = false;
		else error = committed.error?.message ?? "Budge couldn't save the import. Try again.";
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
					class="h-9 rounded-md border border-input bg-card px-2.5 text-base md:text-sm pointer-coarse:h-11"
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

			<p role="alert" class="min-h-6 text-sm text-destructive">{error}</p>
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
	{:else if decision.kind !== 'skip' && decision.candidates !== undefined}
		{@render picker(index, decision.candidates)}
	{:else if decision.kind === 'new'}
		New
	{:else if decision.kind === 'skip'}
		Duplicate, skipped
	{:else}
		<span class="text-xs">
			Matches {decision.transaction.payeeName ?? 'No Payee'}, {formatDate(
				decision.transaction.date,
				'short'
			)}
		</span>
	{/if}
{/snippet}

{#snippet picker(index: number, candidates: PreviewCandidate[])}
	<label class="flex flex-col gap-1 text-xs">
		<span>Match with</span>
		<select
			bind:value={picks[index]}
			required
			class="h-9 max-w-56 rounded-md border border-input bg-card px-2 text-base md:text-sm pointer-coarse:h-11"
		>
			<option value="">Pick one</option>
			{#each candidates as candidate (candidate._id)}
				<option value={candidate._id}>
					{candidate.payeeName ?? 'No Payee'}, {formatDate(candidate.date, 'short')}{candidate.memo
						? `, ${candidate.memo}`
						: ''}
				</option>
			{/each}
			<option value="new">None, add as new</option>
		</select>
	</label>
{/snippet}
