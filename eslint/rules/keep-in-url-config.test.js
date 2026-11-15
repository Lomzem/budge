import { ESLint } from 'eslint';
import ts from 'typescript-eslint';
import { expect, test } from 'vitest';

const eslint = new ESLint({
	overrideConfig: {
		...ts.configs.disableTypeChecked,
		languageOptions: { parserOptions: { projectService: false, project: false } }
	}
});

const restricted = async (filePath, name) => {
	const code = `<script lang="ts">\n\timport { ${name} } from '$app/navigation';\n\tvoid ${name};\n</script>\n`;
	const [result] = await eslint.lintText(code, { filePath });
	return result.messages.some((m) => m.ruleId === 'no-restricted-imports');
};

test.each([
	['src/routes/(app)/+page.svelte', 'replaceState'],
	['src/lib/components/transactions/transaction-table.svelte', 'pushState'],
	['src/lib/components/categories/rename-dialog.svelte', 'replaceState']
])('%s may not write a shallow history entry with %s', async (filePath, name) => {
	expect(await restricted(filePath, name)).toBe(true);
});

test('app code may still navigate with goto', async () => {
	expect(await restricted('src/routes/(app)/+page.svelte', 'goto')).toBe(false);
});
