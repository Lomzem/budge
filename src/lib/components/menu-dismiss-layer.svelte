<script lang="ts">
	const clickAfterPress = 600;

	let pressed = $state(false);
	let letGo: ReturnType<typeof setTimeout> | undefined;

	function catchTaps(node: HTMLElement) {
		const closeTheMenuOnAnyButton = (event: PointerEvent) => {
			if (event.button === 0) return;
			node.dispatchEvent(
				new PointerEvent('pointerdown', {
					bubbles: true,
					cancelable: true,
					composed: true,
					button: 0,
					buttons: 1,
					clientX: event.clientX,
					clientY: event.clientY,
					pointerId: event.pointerId,
					pointerType: event.pointerType,
					isPrimary: event.isPrimary
				})
			);
		};
		const press = (event: PointerEvent) => {
			clearTimeout(letGo);
			pressed = true;
			closeTheMenuOnAnyButton(event);
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
		window.addEventListener('blur', landed);
		return () => {
			clearTimeout(letGo);
			node.removeEventListener('pointerdown', press);
			node.removeEventListener('pointerup', release);
			node.removeEventListener('pointercancel', release);
			node.removeEventListener('click', landed);
			node.removeEventListener('contextmenu', keepTheBrowserMenuClosed);
			window.removeEventListener('blur', landed);
		};
	}
</script>

<div
	data-slot="menu-dismiss-layer"
	data-pressed={pressed ? '' : undefined}
	aria-hidden="true"
	{@attach catchTaps}
></div>
