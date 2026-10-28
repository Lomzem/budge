// Shared by the server, which inlines the script into `<head>`, and the `Theme` class.

export const THEME_STORAGE_KEY = 'budge-theme';

/** The page background in each theme, for the browser and iOS status bar. */
export const THEME_COLORS = { light: '#ffffff', dark: '#0a0a0a' } as const;

/** Runs before first paint, so a stored or system dark theme never flashes light. */
export const themeScript = `try{var c=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}),d=c==="dark"||(c!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.querySelector('meta[name="theme-color"]').content=d?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)}}catch(e){}`;
