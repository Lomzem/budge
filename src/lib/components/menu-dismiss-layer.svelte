<script lang="ts">
	const clickAfterPress = 600;

	let pressed = $state(false);
	let letGo: ReturnType<typeof setTimeout> | undefined;

	function catchTaps(node: HTMLElement) {
		const press = () => {
			clearTimeout(letGo);
			pressed = true;
		};
		const release = () => {
			clearTimeout(letGo);
			letGo = setTimeout(() => {
				pressed = false;
			}, clickAfterPress);
		};
		const landed = () => {
			clearTimeout(letGo);
			pressed = false;
		};
		const keepTheBrowserMenuClosed = (event: MouseEvent) => {
			event.preventDefault();
		};
		node.addEventListener('pointerdown', press);
		node.addEventListener('pointerup', release);
		node.addEventListener('pointercancel', release);
		node.addEventListener('click', landed);
		node.addEventListener('contextmenu', keepTheBrowserMenuClosed);
		return () => {
			clearTimeout(letGo);
			node.removeEventListener('pointerdown', press);
			node.removeEventListener('pointerup', release);
			node.removeEventListener('pointercancel', release);
			node.removeEventListener('click', landed);
			node.removeEventListener('contextmenu', keepTheBrowserMenuClosed);
		};
	}
</script>

<div
	data-slot="menu-dismiss-layer"
	data-pressed={pressed ? '' : undefined}
	aria-hidden="true"
	{@attach catchTaps}
></div>
