<script lang="ts">
	import { ClerkProvider } from 'svelte-clerk';

	import '../app.css';
	import MenuDismissLayer from '$lib/components/menu-dismiss-layer.svelte';
	import { Theme, setTheme } from '$lib/theme.svelte';

	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	setTheme(new Theme());
</script>

<ClerkProvider
	{...data}
	signInUrl="/sign-in"
	signInFallbackRedirectUrl="/"
	afterSignOutUrl="/sign-in"
>
	{@render children()}
	<MenuDismissLayer />
</ClerkProvider>
