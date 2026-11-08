import { ESLint } from 'eslint';
import { expect, test } from 'vitest';

const eslint = new ESLint();

const restricted = async (filePath) => {
	const code = `<script lang="ts">\n\timport { attempt } from '$lib/attempt';\n\tvoid attempt;\n</script>\n`;
	const [result] = await eslint.lintText(code, { filePath });
	return result.messages.some((m) => m.ruleId === 'no-restricted-imports');
};

test.each([
	'src/lib/components/categories/rename-dialog.svelte',
	'src/lib/components/accounts/starting-balance-step.svelte',
	'src/lib/components/shell/bank-connections.svelte',
	'src/lib/components/shell/held-accounts.svelte'
])('%s must run its work through DialogSession, not attempt', async (filePath) => {
	expect(await restricted(filePath)).toBe(true);
});

test('a component outside a dialog may use attempt', async () => {
	expect(await restricted('src/lib/components/budget/assigned-input.svelte')).toBe(false);
});
