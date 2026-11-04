import { ESLint } from 'eslint';
import ts from 'typescript-eslint';
import { expect, test } from 'vitest';

const eslint = new ESLint({
	overrideConfig: {
		...ts.configs.disableTypeChecked,
		languageOptions: { parserOptions: { projectService: false, project: false } }
	}
});

const restrictedSyntax = async (source) => {
	const [result] = await eslint.lintText(source, { filePath: 'convex/lib/transactions.ts' });
	return result.messages
		.filter((message) => message.ruleId === 'no-restricted-syntax')
		.map((message) => message.message);
};

const caller = (name, imported, call) =>
	`${imported}\nexport async function ${name}(ctx, id) {\n\treturn await ${call}(ctx, id);\n}\n`;

const named = "import { bankRowsShown } from './transactions';";
const capped = expect.stringContaining('`bankRowsShown` caps Bank Rows for display');

test('only the list row reads the display-capped Bank Rows', async () => {
	expect(await restrictedSyntax(caller('refreshSearchText', named, 'bankRowsShown'))).toEqual([
		capped
	]);
	expect(await restrictedSyntax(caller('toRow', named, 'bankRowsShown'))).toEqual([]);
});

test('renaming or namespacing the import does not get around the list-row rule', async () => {
	const namespaced = "import * as transactions from './transactions';";
	expect(
		await restrictedSyntax(
			caller('refreshSearchText', "import { bankRowsShown as rows } from './transactions';", 'rows')
		)
	).toContainEqual(capped);
	expect(
		await restrictedSyntax(caller('refreshSearchText', namespaced, 'transactions.bankRowsShown'))
	).toEqual([capped]);
	expect(await restrictedSyntax(caller('toRow', namespaced, 'transactions.bankRowsShown'))).toEqual(
		[]
	);
});

test('local aliases cannot hide display-capped reads', async () => {
	expect(await restrictedSyntax(`${named} const read = bankRowsShown;`)).toEqual([capped]);
	expect(
		await restrictedSyntax(
			"import * as transactions from './transactions'; const read = transactions.bankRowsShown;"
		)
	).toEqual([capped]);
});

test.each([
	`${named} let read; read = bankRowsShown;`,
	"import * as transactions from './transactions'; let read; read = transactions.bankRowsShown;"
])('assignments cannot hide display-capped reads: %s', async (source) => {
	expect(await restrictedSyntax(source)).toEqual([capped]);
});
