<script lang="ts">
	import { Progress } from '$lib/components/ui/progress';

	let {
		progress,
		label,
		text
	}: {
		/** How full the bar is, from 0 to 1. */
		progress: number;
		/** What the bar measures, such as "Groceries Target". */
		label: string;
		/** The status in words: the bar's text equivalent. */
		text: string;
	} = $props();
</script>

<Progress value={Math.round(progress * 100)} max={100} aria-label={label} aria-valuetext={text} />
