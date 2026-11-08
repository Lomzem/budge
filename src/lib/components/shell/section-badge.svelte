<script lang="ts">
	let { count, label }: { count: string; label: string } = $props();
</script>

<span
	class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs leading-none font-bold text-primary-foreground"
>
	<span class="sr-only">,&nbsp;</span>{count}<span class="sr-only">&nbsp;{label}</span>
</span>
