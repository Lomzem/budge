<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import { getBankConnections } from '$lib/bankConnections.svelte';
	import { Button } from '$lib/components/ui/button';

	const connections = getBankConnections();
	let result = $state('');

	async function reconnect(connectionId: Id<'bankConnections'>) {
		result = '';
		result = (await connections.reconnect(connectionId)) ?? '';
	}
</script>

{#each connections.needingAttention as connection (connection._id)}
	<p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
		<span>{connection.name} needs you to reconnect</span>
		<Button
			variant="outline"
			size="sm"
			disabled={connections.reconnecting !== null}
			onclick={() => reconnect(connection._id)}
		>
			{connections.reconnecting === connection._id ? 'Reconnecting…' : 'Reconnect'}
		</Button>
	</p>
{/each}
{#if result}
	<p role="status" class="text-sm">{result}</p>
{/if}
