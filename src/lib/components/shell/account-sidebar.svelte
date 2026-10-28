<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { VIEWS } from '$lib/views';

	import AppMenu from './app-menu.svelte';
</script>

<nav aria-label="Budget and Accounts" class="flex flex-1 flex-col gap-4 p-3">
	<p class="px-2 text-lg font-semibold">Budge</p>
	<ul class="flex flex-col gap-0.5 text-sm">
		{#each VIEWS as view (view.href)}
			<li>
				<a
					href={resolve(view.href)}
					aria-current={view.href === page.url.pathname ? 'page' : undefined}
					class="block rounded-md px-2 py-1.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground"
				>
					{view.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>
<div class="border-t border-sidebar-border p-3">
	<AppMenu wide />
</div>
