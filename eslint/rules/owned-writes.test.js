import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import rule from './owned-writes.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const options = [{ tables: ['transactions', 'imports'] }];

new RuleTester().run('owned-writes', rule, {
	valid: [
		{
			name: 'read-only helper receives query results',
			code: 'read(await ctx.db.query("transactions").collect());',
			options
		},
		{ name: 'read-only helper receives detached get', code: 'read(ctx.db.get);', options },
		{
			name: 'helper receives ctx and its writes stay checked where it makes them',
			code: 'function save(ctx) { return ctx.db.patch("accounts", id, {}); } save(ctx);',
			options
		},
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
			name: `detached database ${method}`,
			code: `const write = ctx.db.${method}; write("transactions", id, {});`,
			options,
			errors: [{ messageId: 'detachedWrite', data: { method } }]
		})),
		{
			name: 'assigned detached method from a database alias',
			code: 'const store = ctx.db; let patch; patch = store["patch"]; patch("transactions", id, {});',
			options,
			errors: [{ messageId: 'detachedWrite', data: { method: 'patch' } }]
		},
		{
			name: 'database passed to differently named helper parameter',
			code: 'function write(store) { store.patch("transactions", id, {}) } write(ctx.db);',
			options,
			errors: [{ messageId: 'databaseArgument' }]
		},
		{
			name: 'database alias passed to a helper',
			code: 'const store = ctx.db; helper(store);',
			options,
			errors: [{ messageId: 'databaseArgument' }]
		},
		{
			name: 'literal db parameter remains checked',
			code: 'function write(db) { db.patch("transactions", id, {}); }',
			options,
			errors: [{ messageId: 'ownedTable', data: { table: 'transactions' } }]
		},
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
			name: 'destructured patch remains checked',
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
