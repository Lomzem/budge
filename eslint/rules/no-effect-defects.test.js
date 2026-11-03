import { RuleTester } from 'eslint';
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
		'import { Effect } from "effect"; function setup() { const Fx = Effect; } function run(Fx) { Fx.die("unrelated"); }',

		'Effect.fail("retryable");',
		{ filename: '/repo/convex/lib/plaidClient.ts', code, options }
	],
	invalid: [
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
