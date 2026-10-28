<script lang="ts">
	import { useClerkContext } from 'svelte-clerk';

	import { Button } from '$lib/components/ui/button';

	const clerk = useClerkContext();
</script>

<Button variant="outline" onclick={() => void clerk.clerk?.signOut()}>Sign out</Button>
