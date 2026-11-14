<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';

	let {
		checked = $bindable(false),
		label,
		hint
	}: {
		checked?: boolean;
		label: string;
		hint: string;
	} = $props();

	const id = $props.id();
</script>

<div class="flex items-start gap-2 break-words">
	<span class="mt-0.5 flex">
		<Checkbox
			id="{id}-remember"
			bind:checked
			aria-describedby={hint === '' ? undefined : `${id}-remember-hint`}
		/>
	</span>
	<span class="flex min-w-0 flex-col gap-0.5">
		<Label for="{id}-remember">{label}</Label>
		{#if hint !== ''}
			<span id="{id}-remember-hint" class="text-xs text-muted-foreground">{hint}</span>
		{/if}
	</span>
</div>
