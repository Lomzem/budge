<script lang="ts">
	import { ClerkProvider } from 'svelte-clerk';

	import font from '@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url';

	import '../app.css';
	import { Theme, setTheme } from '$lib/theme.svelte';

	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	setTheme(new Theme());
</script>

<svelte:head>
	<link rel="preload" href={font} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<ClerkProvider
	{...data}
	signInUrl="/sign-in"
	signInFallbackRedirectUrl="/"
	afterSignOutUrl="/sign-in"
>
	{@render children()}
</ClerkProvider>
