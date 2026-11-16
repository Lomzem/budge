import { RuleTester } from 'eslint';
import ts from 'typescript-eslint';
import { describe, it } from 'vitest';

import rule from './no-effect-defects.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const boundary = {
	file: 'convex/lib/plaidClient.ts',
	className: 'PlaidClient',
	method: 'layerTest',
	reason: 'Unexpected fake calls violate the test contract.'
};
const options = [{ allow: [boundary] }];
const code = 'class PlaidClient { static layerTest() { return Effect.die("unexpected"); } }';

new RuleTester().run('no-effect-defects', rule, {
	valid: [
		'import * as E from "effect/Effect"; E.fail("retryable");',
		'import { fail } from "effect/Effect"; fail("retryable");',
		'import * as Fx from "effect"; Fx.Effect.fail("retryable");',
		'import * as E from "effect/Effect"; function f(E) { E.orDie(x); }',
		'import { orDie as fatal } from "effect/Effect"; function f(fatal) { fatal(x); }',
		'import * as Fx from "effect"; function f(Fx) { Fx.Effect.orDie(x); }',
		...[
			['import * as E from "effect/Effect";', 'E.die'],
			['import { die as fatal } from "effect/Effect";', 'fatal'],
			['import * as Fx from "effect";', 'Fx.Effect.die']
		].map(([imports, call]) => ({
			name: 'approved boundary: ' + imports,
			filename: '/repo/convex/lib/plaidClient.ts',
			code: imports + code.replace('Effect.die', call),
			options
		})),
		'import { Effect } from "effect"; function run(Effect) { const Fx = Effect; Fx.die("unrelated"); }',
		'import { Effect } from "effect"; function run(Effect) { Effect.die("unrelated"); }',
		'import { Effect as Fx } from "effect"; function run(Fx) { Fx.die("unrelated"); }',

		'import { Effect } from "effect"; function setup() { const Fx = Effect; } function run(Fx) { Fx.die("unrelated"); }',

		'Effect.fail("retryable");',
		{ filename: '/repo/convex/lib/plaidClient.ts', code, options }
	],
	invalid: [
		...['die', 'dieMessage', 'orDie', 'orDieWith'].flatMap((method) => [
			{
				name: `subpath namespace ${method}`,
				code: `import * as E from "effect/Effect"; E.${method}(x);`,
				errors: [{ messageId: 'defect' }]
			},
			{
				name: `subpath named ${method}`,
				code: `import { ${method} as fatal } from "effect/Effect"; fatal(x);`,
				errors: [{ messageId: 'defect' }]
			},
			{
				name: `root namespace ${method}`,
				code: `import * as Fx from "effect"; Fx.Effect.${method}(x);`,
				errors: [{ messageId: 'defect' }]
			}
		]),
		{
			name: 'subpath named orDie without renaming',
			code: 'import { orDie } from "effect/Effect"; orDie(x);',
			errors: [{ messageId: 'defect' }]
		},
		{
			code: 'import { Effect } from "effect"; let Fx; Fx = Effect; Fx.die("boundary");',
			errors: [{ messageId: 'defect' }]
		},
		{
			code: 'import { Effect } from "effect"; const Fx = Effect; Fx.die("boundary");',
			errors: [{ messageId: 'defect' }]
		},
		...['die', 'dieMessage', 'orDie', 'orDieWith'].map((method) => ({
			code: `Effect.${method}("boundary");`,
			errors: [{ messageId: 'defect' }]
		})),
		{
			code: 'import { Effect as Fx } from "effect"; Fx["die"]("boundary");',
			errors: [{ messageId: 'defect' }]
		},
		{
			filename: '/repo/convex/lib/other.ts',
			code,
			options,
			errors: [{ messageId: 'defect' }]
		},
		{
			filename: '/repo/convex/lib/plaidClient.ts',
			code: code.replace('layerTest', 'layerLive'),
			options,
			errors: [{ messageId: 'defect' }]
		}
	]
});

new RuleTester({ languageOptions: { parser: ts.parser } }).run('no-effect-defects types', rule, {
	valid: [
		'import type { orDie } from "effect/Effect"; type F = typeof orDie;',
		'import { type orDie } from "effect/Effect"; type F = typeof orDie;',
		'import { orDie } from "effect/Effect"; type F = typeof orDie;'
	],
	invalid: [
		{
			code: 'import { orDie } from "effect/Effect"; const f: typeof orDie = orDie;',
			errors: [{ messageId: 'defect' }]
		}
	]
});
