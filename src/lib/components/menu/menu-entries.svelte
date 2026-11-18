<script lang="ts">
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	import type { MenuEntry } from './types';

	let { menu, entries }: { menu: 'context' | 'dropdown'; entries: readonly MenuEntry[] } = $props();

	const M = $derived(menu === 'context' ? ContextMenu : DropdownMenu);
</script>

{#each entries as entry, at (at)}
	{#if entry.kind === 'separator'}
		<M.Separator />
	{:else if entry.kind === 'sub'}
		{#if entry.items.length > 0}
			<M.Sub>
				<M.SubTrigger>{entry.label}</M.SubTrigger>
				<M.SubContent>
					{#each entry.items as item (item.key)}
						<M.Item onSelect={item.run}>{item.label}</M.Item>
					{/each}
				</M.SubContent>
			</M.Sub>
		{/if}
	{:else}
		<M.Item
			variant={entry.destructive === true ? 'destructive' : 'default'}
			disabled={entry.disabled === true}
			onSelect={entry.run}
		>
			{entry.label}
		</M.Item>
	{/if}
{/each}
