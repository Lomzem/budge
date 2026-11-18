<script lang="ts">
	import { tick } from 'svelte';

	import type { Id } from '$convex/_generated/dataModel';
	import type { BudgetView } from '$lib/budget.svelte';
	import { CategoryActions } from '$lib/categoryActions.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatCents } from '$lib/domain/money';
	import { keepRefusalInView } from '$lib/refusalInView';

	interface Member {
		id: Id<'categories'>;
		name: string;
		available: number;
	}

	type HiddenRow =
		| { kind: 'group'; id: Id<'categoryGroups'>; name: string; categories: Member[] }
		| ({ kind: 'category' } & Member);

	let { hidden }: { hidden: BudgetView['hidden'] } = $props();

	const actions = new CategoryActions();

	const availableOf = $derived(
		new Map(hidden.map((category) => [category.id, category.available]))
	);

	const rows = $derived(
		actions.groups.flatMap((group): HiddenRow[] => {
			if (group.hidden)
				return [
					{
						kind: 'group',
						id: group._id,
						name: group.name,
						categories: group.categories.map((category) => ({
							id: category._id,
							name: category.name,
							available: availableOf.get(category._id) ?? 0
						}))
					}
				];
			return group.categories
				.filter((category) => category.hidden)
				.map((category) => ({
					kind: 'category',
					id: category._id,
					name: category.name,
					available: availableOf.get(category._id) ?? 0
				}));
		})
	);

	async function show(row: HiddenRow) {
		const shown =
			row.kind === 'group'
				? await actions.setGroupHidden(row.id, false)
				: await actions.setHidden(row.id, false);
		if (!shown) return;
		await tick();
		if (document.activeElement !== null && document.activeElement !== document.body) return;
		const restored = row.kind === 'group' ? 'data-group-id' : 'data-category-id';
		[...document.querySelectorAll<HTMLElement>(`[${restored}="${row.id}"]`)]
			.find((element) => element.checkVisibility())
			?.focus();
	}
</script>

{#snippet balance(available: number)}
	<span class={['shrink-0 tabular-nums', available < 0 && 'text-destructive']}>
		<span class="sr-only">{available < 0 ? 'Overspent' : 'Available'}</span>
		{formatCents(available)}
	</span>
{/snippet}

{#if rows.length > 0}
	<section aria-labelledby="hidden-heading" class="flex max-w-md flex-col gap-2">
		<h2 id="hidden-heading" class="text-sm font-semibold text-muted-foreground">Hidden</h2>
		<ul class="flex flex-col divide-y rounded-lg border bg-card">
			{#each rows as row (row.id)}
				<li class="flex min-h-11 flex-wrap items-center gap-x-4 px-4 py-1.5">
					<span class="min-w-0 flex-1">
						<span class={['block truncate', row.kind === 'group' && 'font-semibold']}
							>{row.name}</span
						>
					</span>
					{#if row.kind === 'category'}
						{@render balance(row.available)}
					{/if}
					<Button
						variant="ghost"
						size="sm"
						aria-label="Show {row.name}"
						onclick={() => {
							void show(row);
						}}
					>
						Show
					</Button>
					{#if row.kind === 'group' && row.categories.length > 0}
						<ul class="flex basis-full flex-col pb-1 pl-4 text-sm text-muted-foreground">
							{#each row.categories as member (member.id)}
								<li class="flex items-center gap-4">
									<span class="min-w-0 flex-1 truncate">{member.name}</span>
									{@render balance(member.available)}
								</li>
							{/each}
						</ul>
					{/if}
					{#if actions.failure !== null && actions.failure.id === row.id}
						<p
							role="alert"
							class="basis-full pb-1 text-sm text-destructive"
							{@attach keepRefusalInView}
						>
							{actions.failure.message}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
