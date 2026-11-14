import { ESLint } from 'eslint';
import ts from 'typescript-eslint';
import { expect, test } from 'vitest';

const eslint = new ESLint({
	overrideConfig: {
		...ts.configs.disableTypeChecked,
		languageOptions: { parserOptions: { projectService: false, project: false } }
	}
});

const lint = async (filePath, code) => {
	const [result] = await eslint.lintText(code, { filePath });
	return result.messages
		.filter((m) => m.ruleId === 'local/owned-writes' || m.ruleId === 'no-restricted-imports')
		.map((m) => m.ruleId);
};

const rawWrite = (table) =>
	`export async function f(ctx, id) {\n\tawait ctx.db.patch('${table}', id, {});\n}\n`;

test.each(['transactions', 'transactionSplits', 'imports', 'monthlyTotals'])(
	'a raw write to %s outside its owners is refused',
	async (table) => {
		expect(await lint('convex/imports.ts', rawWrite(table))).toEqual(['local/owned-writes']);
		expect(await lint('convex/lib/bankChanges.ts', rawWrite(table))).toEqual([
			'local/owned-writes'
		]);
	}
);

test.each([
	'convex/lib/transactions.ts',
	'convex/lib/monthlyTotals.ts',
	'convex/migrations.ts',
	'convex/seed.ts'
])('%s may write the owned tables', async (filePath) => {
	expect(await lint(filePath, rawWrite('transactions'))).toEqual([]);
});

test('only the owners import the search-text and totals updaters', async () => {
	const imports = [
		"import { refreshDerivedFields } from './lib/transactions';",
		"import { countTransaction, countTransactions, rebuildTotals } from './lib/monthlyTotals';",
		'export { refreshDerivedFields, countTransaction, countTransactions, rebuildTotals };\n'
	].join('\n');

	expect(await lint('convex/categories.ts', imports)).toEqual([
		'no-restricted-imports',
		'no-restricted-imports',
		'no-restricted-imports',
		'no-restricted-imports'
	]);
	expect(
		await lint(
			'convex/categories.ts',
			"import { countTransaction } from './lib/monthlyTotals.ts';\nexport { countTransaction };\n"
		)
	).toEqual(['no-restricted-imports']);
	expect(await lint('convex/migrations.ts', imports)).toEqual([]);
	expect(
		await lint(
			'convex/lib/imports.ts',
			"import { insertTransaction } from './transactions';\nexport { insertTransaction };\n"
		)
	).toEqual([]);
});
