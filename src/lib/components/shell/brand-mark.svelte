<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 512 512" aria-hidden="true" class={['shrink-0', className]}>
	<rect width="512" height="512" rx="112" class="fill-primary" />
	<g class="fill-primary-foreground">
		<rect x="136" y="136" width="240" height="40" rx="20" />
		<rect x="136" y="208" width="176" height="40" rx="20" />
		<rect x="136" y="280" width="208" height="40" rx="20" />
		<rect x="136" y="348" width="240" height="14" />
		<rect x="136" y="376" width="240" height="14" />
	</g>
</svg>
