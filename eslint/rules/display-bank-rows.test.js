import { ESLint } from 'eslint';
import ts from 'typescript-eslint';
import { expect, test } from 'vitest';

const eslint = new ESLint({
	overrideConfig: {
		...ts.configs.disableTypeChecked,
		languageOptions: { parserOptions: { projectService: false, project: false } }
	}
});

const restrictedSyntax = async (caller) => {
	const [result] = await eslint.lintText(
		`import { bankRowsShown } from './lib/transactions';\nexport async function ${caller}(ctx, id) {\n\treturn await bankRowsShown(ctx, id);\n}\n`,
		{ filePath: 'convex/lib/transactions.ts' }
	);
	return result.messages.filter((message) => message.ruleId === 'no-restricted-syntax');
};

test('only the list row reads the display-capped Bank Rows', async () => {
	expect(await restrictedSyntax('refreshSearchText')).toMatchObject([
		{ message: expect.stringContaining('`bankRowsShown` caps linked Bank Rows for display') }
	]);
	expect(await restrictedSyntax('toRow')).toEqual([]);
});
