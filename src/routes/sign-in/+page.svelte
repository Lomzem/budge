<script lang="ts">
	import { SignIn } from 'svelte-clerk';

	import BrandMark from '$lib/components/shell/brand-mark.svelte';
</script>

<svelte:head>
	<title>Sign in · Budge</title>
</svelte:head>

<main class="flex flex-1 flex-col items-center justify-center gap-8 p-4">
	<div class="flex max-w-sm flex-col items-center gap-3 text-center">
		<div class="flex items-center gap-3">
			<BrandMark class="size-10" />
			<h1 class="text-3xl font-bold tracking-tight">Budge</h1>
		</div>
		<p class="text-muted-foreground">Give every dollar a job, from the money you have today.</p>
	</div>
	<div class="flex min-h-112 w-full justify-center">
		<SignIn routing="hash" />
	</div>
</main>
