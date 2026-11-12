export const THEME_STORAGE_KEY = 'budge-theme';

export const THEME_COLORS = { light: '#f3f6f1', dark: '#0f1713' } as const;

export const themeScript = `try{var c=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}),d=c==="dark"||(c!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.querySelector('meta[name="theme-color"]').content=d?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)}}catch(e){}`;
