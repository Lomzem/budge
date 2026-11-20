import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';

const eslint = new ESLint({ overrideConfigFile: 'eslint.ui.config.js' });

const content = (classes) => `<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	let { class: className, ...restProps }: DropdownMenuPrimitive.ContentProps = $props();
</script>

<DropdownMenuPrimitive.Content class={cn('${classes}', className)} {...restProps} />
`;

const refusesClosingAnimation = async (filePath, classes) => {
	const [result] = await eslint.lintText(content(classes), { filePath });
	expect(result.messages.filter((m) => m.fatal)).toEqual([]);
	return result.messages.some((m) => m.message.startsWith('A closing menu, select, or popover'));
};

const opening = 'z-50 rounded-lg bg-popover data-open:animate-in data-open:fade-in-0';

describe('popup content unmounts as soon as it closes', () => {
	test.each([
		['dropdown-menu/dropdown-menu-content', 'data-closed:animate-out data-closed:fade-out-0'],
		['dropdown-menu/dropdown-menu-sub-content', 'data-closed:zoom-out-95'],
		['context-menu/context-menu-content', 'data-closed:animate-out'],
		['select/select-content', 'data-closed:fade-out-0'],
		['popover/popover-content', 'data-closed:animate-out data-closed:zoom-out-95']
	])('%s with %s is refused', async (file, closing) => {
		expect(
			await refusesClosingAnimation(`src/lib/components/ui/${file}.svelte`, `${opening} ${closing}`)
		).toBe(true);
	});

	test('popup content that only animates in is allowed', async () => {
		expect(
			await refusesClosingAnimation(
				'src/lib/components/ui/dropdown-menu/dropdown-menu-content.svelte',
				opening
			)
		).toBe(false);
	});

	test('dialog content keeps its exit animation', async () => {
		expect(
			await refusesClosingAnimation(
				'src/lib/components/ui/dialog/dialog-content.svelte',
				`${opening} data-closed:animate-out data-closed:fade-out-0`
			)
		).toBe(false);
	});
});
