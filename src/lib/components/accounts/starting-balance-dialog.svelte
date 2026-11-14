<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import * as Dialog from '$lib/components/ui/dialog';
	import { DialogSession } from '$lib/dialogSession.svelte';
	import type { FocusReturn } from '$lib/focusReturn';

	import StartingBalanceStep from './starting-balance-step.svelte';

	interface Checked {
		_id: Id<'accounts'>;
		kind: 'cash' | 'creditCard';
		name: string;
	}

	let {
		onconfirmed,
		returnFocus
	}: {
		onconfirmed?: (account: Checked) => void;
		returnFocus: FocusReturn;
	} = $props();

	const dialog = new DialogSession<{ account: Checked }>();

	export function open(account: Checked) {
		dialog.open({ account: { _id: account._id, kind: account.kind, name: account.name } });
	}
</script>

<Dialog.Root
	open={dialog.current !== null}
	onOpenChange={(isOpen) => {
		if (!isOpen) dialog.dismiss();
	}}
>
	<Dialog.Content {returnFocus}>
		{#if dialog.current !== null}
			{@const session = dialog.current}
			{#key session}
				<StartingBalanceStep
					account={session.account}
					onDone={(confirmed) => {
						const account = session.account;
						dialog.close(session);
						if (confirmed) onconfirmed?.(account);
					}}
				/>
			{/key}
		{/if}
	</Dialog.Content>
</Dialog.Root>
