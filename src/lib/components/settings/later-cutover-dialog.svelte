<script lang="ts">
	import { useMutation } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import * as Dialog from '$lib/components/ui/dialog';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import { localToday } from '$lib/domain/dates';

	import LaterCutoverPreview from './later-cutover-preview.svelte';

	interface Opening {
		from: string;
		to: string;
		today: string;
	}

	let { onmoved, onclosed }: { onmoved: () => void; onclosed: () => void } = $props();

	const setCutoverDate = useMutation(api.settings.setCutoverDate);
	const dialog = new DialogSession<Opening, 'move'>();
	let error = $state('');

	export function open(from: string, to: string) {
		error = '';
		dialog.open({ from, to, today: localToday() });
	}

	async function move(session: Opening) {
		error = '';
		const moved = await dialog.run('move', () => setCutoverDate({ cutoverDate: session.to }));
		if (!moved.ok) {
			error = moved.error?.message ?? "Budge couldn't move the date. Try again.";
			return;
		}
		onmoved();
		dialog.close(session);
	}
</script>

<Dialog.Root
	open={dialog.current !== null}
	onOpenChange={(isOpen) => {
		if (!isOpen) dialog.dismiss();
	}}
>
	<Dialog.Content
		size="wide"
		onCloseAutoFocus={(event: Event) => {
			event.preventDefault();
			onclosed();
		}}
	>
		{#if dialog.current !== null}
			{@const session = dialog.current}
			{#key session}
				<LaterCutoverPreview
					from={session.from}
					to={session.to}
					today={session.today}
					{error}
					moving={dialog.pending('move')}
					onmove={() => move(session)}
					oncancel={() => {
						dialog.close(session);
					}}
				/>
			{/key}
		{/if}
	</Dialog.Content>
</Dialog.Root>
