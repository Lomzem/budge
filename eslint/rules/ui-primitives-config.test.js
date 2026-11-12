import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';

const eslint = new ESLint({ overrideConfigFile: 'eslint.ui.config.js' });

const refusals = async (imports, markup) => {
	const code = `<script lang="ts">\n${imports}\n\tlet value = $state('');\n\tlet wide = $state(false);\n</script>\n\n${markup}\n`;
	const [result] = await eslint.lintText(code, {
		filePath: 'src/lib/components/budget/example.svelte'
	});
	expect(result.messages.filter((m) => m.fatal)).toEqual([]);
	return result.messages
		.filter((m) => m.ruleId === 'no-restricted-syntax')
		.map((m) => (m.message.includes('native <select>') ? 'select' : 'scroll'));
};

describe('app components pick from shadcn-svelte, not native controls', () => {
	test.each([
		[
			'a native select',
			'',
			'<select bind:value><option value="a">A</option><option value="b">B</option></select>',
			['select']
		],
		[
			'a static overflow-y-auto class',
			'',
			'<div class="max-h-80 overflow-y-auto"></div>',
			['scroll']
		],
		[
			'overflow-x-auto in a class array',
			'',
			"<div class={['flex', wide && 'overflow-x-auto']}></div>",
			['scroll']
		],
		[
			'a breakpoint overflow-scroll in a template class',
			'',
			'<div class={`p-1 ${wide ? "flex" : ""} sm:overflow-scroll`}></div>',
			['scroll']
		],
		['an overflow-auto class directive', '', '<div class:overflow-auto={wide}></div>', ['scroll']],
		[
			'overflow-y-auto through cn()',
			"\timport { cn } from '$lib/utils';\n\tconst rows = cn('flex', 'overflow-y-auto');",
			'<div class={rows}></div>',
			['scroll']
		]
	])('%s is refused', async (_, imports, markup, expected) => {
		expect(await refusals(imports, markup)).toEqual(expected);
	});

	test.each([
		[
			'SelectField',
			"\timport SelectField from '$lib/components/select-field.svelte';",
			"<SelectField id=\"pick\" bind:value choices={[{ value: 'a', label: 'A' }]} />"
		],
		[
			'ScrollArea with overflow-hidden around it',
			"\timport { ScrollArea } from '$lib/components/ui/scroll-area';",
			'<div class="flex max-h-80 flex-col overflow-hidden"><ScrollArea><p>Rows</p></ScrollArea></div>'
		],
		[
			'overflow-auto as text, not a class',
			"\tconst hint = 'Avoid overflow-auto here.';",
			'<p title="overflow-auto">{hint}</p>'
		]
	])('%s is allowed', async (_, imports, markup) => {
		expect(await refusals(imports, markup)).toEqual([]);
	});
});
