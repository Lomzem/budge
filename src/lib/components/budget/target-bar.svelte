<script lang="ts">
	import { Progress } from '$lib/components/ui/progress';

	let {
		progress,
		label,
		text
	}: {
		progress: number;

		label: string;

		text: string;
	} = $props();
</script>

<Progress value={Math.round(progress * 100)} max={100} aria-label={label} aria-valuetext={text} />
