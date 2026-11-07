import { ESLint } from 'eslint';
import ts from 'typescript-eslint';
import { expect, test } from 'vitest';

const eslint = new ESLint({
	overrideConfig: {
		...ts.configs.disableTypeChecked,
		languageOptions: { parserOptions: { projectService: false, project: false } }
	}
});

test.each([
	['test', 'test'],
	['expect', 'test'],
	['test', 'spec'],
	['expect', 'spec']
])('E2E %s imports in .%s files use the fixture', async (name, extension) => {
	const lint = async (source) => {
		const [result] = await eslint.lintText(
			`import { ${name} } from '${source}';\nexport { ${name} };\n`,
			{ filePath: `e2e/import.${extension}.ts` }
		);
		return result.messages.filter((message) => message.ruleId === 'no-restricted-imports');
	};
	expect(await lint('@playwright/test')).toMatchObject([
		{
			message: expect.stringContaining(
				"Import `test` from './test', which reloads a seed fixture before every test."
			)
		}
	]);
	expect(await lint('./test')).toEqual([]);
});
