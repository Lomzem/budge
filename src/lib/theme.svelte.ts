import { createContext } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';

import { THEME_COLORS, THEME_STORAGE_KEY } from './themeScript';

export const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

function isThemeChoice(value: unknown): value is ThemeChoice {
	return THEME_CHOICES.some((choice) => choice === value);
}

function storedChoice(): ThemeChoice {
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		return isThemeChoice(stored) ? stored : 'system';
	} catch {
		return 'system';
	}
}

/** The owner's light or dark theme. Construct once, in the root layout, and share by context. */
export class Theme {
	choice: ThemeChoice = $state('system');
	readonly #systemDark = new MediaQuery('(prefers-color-scheme: dark)');
	readonly dark = $derived(
		this.choice === 'dark' || (this.choice === 'system' && this.#systemDark.current)
	);

	constructor() {
		if (typeof localStorage !== 'undefined') this.choice = storedChoice();
		$effect(() => {
			document.documentElement.classList.toggle('dark', this.dark);
			document
				.querySelector('meta[name="theme-color"]')
				?.setAttribute('content', this.dark ? THEME_COLORS.dark : THEME_COLORS.light);
		});
	}

	choose(choice: ThemeChoice) {
		this.choice = choice;
		try {
			localStorage.setItem(THEME_STORAGE_KEY, choice);
		} catch {
			// Storage can be blocked; the theme still changes for this visit.
		}
	}
}

export const [getTheme, setTheme] = createContext<Theme>();
