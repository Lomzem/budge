export type FocusDestination = () => HTMLElement | null | undefined;

export interface FocusReturn {
	readonly opener?: (opened: HTMLElement | null) => HTMLElement | null | undefined;
	readonly continuation?: FocusDestination;
	readonly fallback: FocusDestination;
}

export const mainRegion: FocusDestination = () => document.getElementById('main');

const dialogs = '[role="dialog"], [role="alertdialog"]';

const focusables =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusedElement(): HTMLElement | null {
	const active = document.activeElement;
	return active instanceof HTMLElement && active !== document.body ? active : null;
}

function controllerOf(element: HTMLElement): HTMLElement {
	const menu = element.closest<HTMLElement>('[role="menu"]');
	if (menu === null || menu.id === '') return element;
	return document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(menu.id)}"]`) ?? element;
}

export function dialogOpener(): HTMLElement | null {
	const active = focusedElement();
	return active === null ? null : controllerOf(active);
}

function topmostOpenDialog(closing: HTMLElement | null): HTMLElement | null {
	const open = [...document.querySelectorAll<HTMLElement>(dialogs)].filter(
		(dialog) => dialog.dataset.state === 'open' && closing?.contains(dialog) !== true
	);
	return open.at(-1) ?? null;
}

function settledIn(within: HTMLElement | null): boolean {
	const active = focusedElement();
	if (active?.isConnected !== true) return false;
	if (within === null) return active.closest(dialogs) === null;
	return within.contains(active) && active.closest(dialogs) === within;
}

function takesFocus(
	element: HTMLElement | null | undefined,
	within: HTMLElement | null,
	options?: FocusOptions
): boolean {
	if (!element?.isConnected || element === document.body) return false;
	if (within !== null && !within.contains(element)) return false;
	element.focus(options);
	return document.activeElement === element;
}

export function restoreFocus(
	destinations: FocusReturn,
	opened: HTMLElement | null,
	closing: HTMLElement | null,
	focusEntered: boolean
): void {
	const within = topmostOpenDialog(closing);
	if (focusEntered && settledIn(within)) return;
	const opener = destinations.opener === undefined ? opened : destinations.opener(opened);
	if (takesFocus(opener, within, opener === opened ? { preventScroll: true } : undefined)) return;
	if (takesFocus(destinations.continuation?.(), within)) return;
	if (takesFocus(destinations.fallback(), within)) return;
	if (within === null) return;
	for (const element of within.querySelectorAll<HTMLElement>(focusables)) {
		if (takesFocus(element, within, { preventScroll: true })) return;
	}
	within.focus({ preventScroll: true });
}
