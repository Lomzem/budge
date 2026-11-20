const controls = 'button, a, input, label, select, textarea, [role="checkbox"], [data-pick]';

export function clickedTheRow(event: MouseEvent): boolean {
	if (!(event.target instanceof Element) || event.target.closest(controls)) return false;
	return getSelection()?.isCollapsed ?? true;
}
