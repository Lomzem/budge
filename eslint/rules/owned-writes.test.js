import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import rule from './owned-writes.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const options = [{ tables: ['transactions', 'imports'] }];

new RuleTester().run('owned-writes', rule, {
	valid: [
		{ code: 'ctx.db.patch("accounts", id, { name });', options },
		{ code: 'ctx.db.get("transactions", id);', options },
		{ code: 'ctx.db.query("imports");', options },
		{ code: 'cache.patch("transactions", id, {});', options },
		{ code: 'const writer = cache; writer.patch("transactions", id, {});', options },
		{
			code: 'function f() { const writer = ctx.db; } const writer = cache; writer.patch("imports", id);',
			options
		}
	],
	invalid: [
		...['insert', 'patch', 'replace', 'delete'].map((method) => ({
			code: `ctx.db.${method}("transactions", id, {});`,
			options,
			errors: [{ messageId: 'ownedTable', data: { table: 'transactions' } }]
		})),
		{
			code: 'const { db } = ctx; db.insert("imports", row);',
			options,
			errors: [{ messageId: 'ownedTable', data: { table: 'imports' } }]
		},
		{
			code: 'const writer = ctx.db; writer.patch("transactions", id, {});',
			options,
			errors: [{ messageId: 'ownedTable', data: { table: 'transactions' } }]
		},
		{
			code: 'let writer; writer = ctx.db; writer.insert("imports", row);',
			options,
			errors: [{ messageId: 'ownedTable', data: { table: 'imports' } }]
		},
		{
			code: 'const { db: writer } = ctx; const again = writer; again.delete("imports", id);',
			options,
			errors: [{ messageId: 'ownedTable', data: { table: 'imports' } }]
		},
		{
			code: 'const { patch } = ctx.db; patch("transactions", id, {});',
			options,
			errors: [{ messageId: 'detachedWrite', data: { method: 'patch' } }]
		},
		{
			code: 'ctx["db"]["delete"]("imports", id);',
			options,
			errors: [{ messageId: 'ownedTable', data: { table: 'imports' } }]
		},
		{
			code: 'ctx.db.patch(id, { cleared: "cleared" });',
			options,
			errors: [{ messageId: 'unnamedTable' }]
		},
		{
			code: 'ctx.db.patch(table, id, {});',
			options,
			errors: [{ messageId: 'unnamedTable' }]
		}
	]
});
