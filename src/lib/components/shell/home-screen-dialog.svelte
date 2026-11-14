<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { mainRegion } from '$lib/focusReturn';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	type Platform = 'apple' | 'android' | 'computer';

	function platformOf(): Platform {
		if (typeof navigator === 'undefined') return 'apple';
		const agent = navigator.userAgent;
		const iPadAsMac = agent.includes('Macintosh') && navigator.maxTouchPoints > 1;
		if (/iPhone|iPad|iPod/.test(agent) || iPadAsMac) return 'apple';
		if (agent.includes('Android')) return 'android';
		return 'computer';
	}

	const platform = $derived(open ? platformOf() : 'apple');

	const steps: Record<Platform, { lead: string; steps: string[]; after: string }> = {
		apple: {
			lead: 'On an iPhone or iPad, in Safari:',
			steps: [
				'Tap Share, in the toolbar or the page menu.',
				"Tap Add to Home Screen. If it's missing, tap Edit Actions to add it.",
				'Leave Open as Web App on, then tap Add.'
			],
			after: "Budge then opens from its icon without Safari's toolbars. Sign in once inside it."
		},
		android: {
			lead: 'On Android, in Chrome:',
			steps: [
				'Tap the menu (three dots) beside the address bar.',
				'Tap Add to home screen, then Install.'
			],
			after: 'Budge then opens from its icon in its own window. Sign in once inside it.'
		},
		computer: {
			lead: 'On a computer, in Chrome or Edge:',
			steps: [
				'Click the install icon at the right end of the address bar, or open the browser menu.',
				'Choose Install Budge (in Chrome, under Cast, save, and share).'
			],
			after:
				'Budge then opens in its own window from your dock or Start menu. In Safari on a Mac, choose File, then Add to Dock.'
		}
	};
	const shown = $derived(steps[platform]);
</script>

<Dialog.Root bind:open>
	<Dialog.Content returnFocus={{ fallback: mainRegion }}>
		<Dialog.Header>
			<Dialog.Title>{platform === 'computer' ? 'Install Budge' : 'Add to Home Screen'}</Dialog.Title
			>
			<Dialog.Description>{shown.lead}</Dialog.Description>
		</Dialog.Header>
		<ol class="flex list-decimal flex-col gap-2 pl-5 text-sm">
			{#each shown.steps as step (step)}
				<li>{step}</li>
			{/each}
		</ol>
		<p class="text-sm text-muted-foreground">{shown.after}</p>
	</Dialog.Content>
</Dialog.Root>
