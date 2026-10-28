<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add to Home Screen</Dialog.Title>
			<Dialog.Description>On an iPhone, in Safari:</Dialog.Description>
		</Dialog.Header>
		<ol class="flex list-decimal flex-col gap-2 pl-5 text-sm">
			<li>Tap Share, in the toolbar or the page menu.</li>
			<li>Tap Add to Home Screen. If it's missing, tap Edit Actions to add it.</li>
			<li>Leave Open as Web App on, then tap Add.</li>
		</ol>
		<p class="text-sm text-muted-foreground">
			Budge then opens from its icon without Safari's toolbars. Sign in once inside it.
		</p>
	</Dialog.Content>
</Dialog.Root>
