<script lang="ts">
	let {
		count,
		label,
		tone = 'plain'
	}: { count: string; label: string; tone?: 'plain' | 'bad' | 'warn' } = $props();

	const tones = {
		plain: 'bg-primary text-primary-foreground',
		bad: 'bg-destructive-tint text-destructive ring-1 ring-destructive',
		warn: 'bg-warning-tint text-warning ring-1 ring-warning'
	};
</script>

<span
	class={[
		'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs leading-none font-bold',
		tones[tone]
	]}
>
	{count}<span class="sr-only">&nbsp;{label}</span>
</span>
