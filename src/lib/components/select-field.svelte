<script lang="ts">
	import * as Select from '$lib/components/ui/select';

	import type { Choices } from './choices';

	let {
		value = $bindable(''),
		choices,
		placeholder = '',
		disabled = false,
		required = false,
		onValueChange,
		...trigger
	}: {
		id: string;
		'aria-invalid'?: boolean;
		'aria-describedby'?: string;
		value?: string;
		choices: Choices;
		placeholder?: string;
		disabled?: boolean;
		required?: boolean;
		onValueChange?: (value: string) => void;
	} = $props();

	const flat = $derived(choices.flatMap((entry) => ('group' in entry ? entry.choices : [entry])));
	const chosen = $derived(flat.find((choice) => choice.value === value));

	const key = (choice: string) => `choice:${choice}`;
	const unkey = (picked: string) => picked.slice('choice:'.length);
</script>

<Select.Root
	type="single"
	bind:value={
		() => (chosen ? key(chosen.value) : ''),
		(picked: string) => {
			if (picked === '') return;
			value = unkey(picked);
			onValueChange?.(value);
		}
	}
	{disabled}
	items={flat.map((choice) => ({
		value: key(choice.value),
		label: choice.label,
		disabled: choice.disabled ?? false
	}))}
>
	<Select.Trigger {...trigger} aria-required={required}>
		<span class="min-w-0 truncate">{chosen?.label ?? placeholder}</span>
	</Select.Trigger>
	<Select.Content>
		{#each choices as entry, index (index)}
			{#if 'group' in entry}
				<Select.Group>
					<Select.GroupHeading>{entry.group}</Select.GroupHeading>
					{#each entry.choices as choice (choice.value)}
						<Select.Item
							value={key(choice.value)}
							label={choice.label}
							disabled={choice.disabled ?? false}
						/>
					{/each}
				</Select.Group>
			{:else}
				<Select.Item
					value={key(entry.value)}
					label={entry.label}
					disabled={entry.disabled ?? false}
				/>
			{/if}
		{/each}
	</Select.Content>
</Select.Root>
