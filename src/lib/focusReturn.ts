export type FocusDestination = () => HTMLElement | null | undefined;

export interface FocusReturn {
	readonly opener?: (opened: HTMLElement | null) => HTMLElement | null | undefined;
	readonly continuation?: FocusDestination;
	readonly fallback: FocusDestination;
}

export const mainRegion: FocusDestination = () => document.getElementById('main');

export function focusedElement(): HTMLElement | null {
	const active = document.activeElement;
	return active instanceof HTMLElement && active !== document.body ? active : null;
}

function settledOutsideDialogs(): boolean {
	const active = focusedElement();
	return (
		active?.isConnected === true && active.closest('[role="dialog"], [role="alertdialog"]') === null
	);
}

function takesFocus(element: HTMLElement | null | undefined, options?: FocusOptions): boolean {
	if (!element?.isConnected || element === document.body) return false;
	element.focus(options);
	return document.activeElement === element;
}

export function restoreFocus(destinations: FocusReturn, opened: HTMLElement | null): void {
	if (settledOutsideDialogs()) return;
	const opener = destinations.opener === undefined ? opened : destinations.opener(opened);
	if (takesFocus(opener, opener === opened ? { preventScroll: true } : undefined)) return;
	if (takesFocus(destinations.continuation?.())) return;
	takesFocus(destinations.fallback());
}
