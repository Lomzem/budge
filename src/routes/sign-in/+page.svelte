<script lang="ts">
	import { SignIn } from 'svelte-clerk';
</script>

<svelte:head>
	<title>Sign in · Budge</title>
</svelte:head>

<main class="flex flex-1 flex-col items-center justify-center gap-6 p-4">
	<h1 class="text-2xl font-semibold">Budge</h1>
	<SignIn routing="hash" />
</main>
