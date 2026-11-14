<script lang="ts">
	import { useMutation } from 'convex-svelte';

	import { api } from '$convex/_generated/api';
	import * as Dialog from '$lib/components/ui/dialog';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import { localToday } from '$lib/domain/dates';
	import type { FocusReturn } from '$lib/focusReturn';

	import LaterCutoverPreview from './later-cutover-preview.svelte';

	interface Opening {
		from: string;
		to: string;
		today: string;
	}

	let { onmoved, returnFocus }: { onmoved: () => void; returnFocus: FocusReturn } = $props();

	const setCutoverDate = useMutation(api.settings.setCutoverDate);
	const applyLaterCutover = useMutation(api.settings.applyLaterCutover);
	const dialog = new DialogSession<Opening, 'move' | 'apply'>();
	let error = $state('');

	export function isOpen() {
		return dialog.current !== null;
	}

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

	async function confirm(session: Opening, fingerprint: string, unlockReconciled: boolean) {
		error = '';
		const applied = await dialog.run('apply', () =>
			applyLaterCutover({
				cutoverDate: session.to,
				today: session.today,
				fingerprint,
				unlockReconciled
			})
		);
		if (!applied.ok) {
			error = applied.error?.message ?? "Budge couldn't move the date. Try again.";
			return;
		}
		onmoved();
		dialog.close(session);
	}
</script>

<Dialog.Root
	open={dialog.current !== null}
	onOpenChange={(next) => {
		if (!next) dialog.dismiss();
	}}
>
	<Dialog.Content size="wide" {returnFocus}>
		{#if dialog.current !== null}
			{@const session = dialog.current}
			{#key session}
				<LaterCutoverPreview
					from={session.from}
					to={session.to}
					today={session.today}
					{error}
					moving={dialog.pending('move') || dialog.pending('apply')}
					onmove={() => move(session)}
					onconfirm={(fingerprint: string, unlock: boolean) =>
						confirm(session, fingerprint, unlock)}
					oncancel={() => {
						dialog.close(session);
					}}
				/>
			{/key}
		{/if}
	</Dialog.Content>
</Dialog.Root>
