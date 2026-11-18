import { RuleTester } from 'eslint';
import svelteParser from 'svelte-eslint-parser';
import { describe, it } from 'vitest';

import rule from './shell-queries.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const owner = 'src/lib/shellQueries.svelte.ts';
const options = [{ owner }];
const filename = `${process.cwd()}/src/lib/example.svelte`;
const svelte = (script) => ({
	filename,
	options,
	code: `<script lang="ts">import { useQuery } from 'convex-svelte';\n${script}</script>`,
	languageOptions: { parser: svelteParser }
});

new RuleTester().run('shell-queries', rule, {
	valid: [
		{ ...svelte('const { settings } = getShellQueries();') },
		{ ...svelte('const accounts = useQuery(api.accounts.list, {});') },
		{ ...svelte('const one = useQuery(api.categories.get, { id });') },
		{
			...svelte(
				"const count = useQuery(api.transactions.unapprovedCount, () => (ready ? { accountId } : 'skip'));"
			)
		},
		{
			filename,
			options,
			code: '<script lang="ts">function useQuery() {}\nconst settings = useQuery(api.settings.get, {});</script>',
			languageOptions: { parser: svelteParser }
		},
		{
			filename: `${process.cwd()}/${owner}`,
			options,
			code: 'this.settings = useQuery(api.settings.get, args);'
		}
	],
	invalid: [
		{
			...svelte('const settings = useQuery(api.settings.get, {});'),
			errors: [{ messageId: 'shared', data: { query: 'api.settings.get', owner } }]
		},
		{
			...svelte("const list = useQuery(api.categories.list, () => (open ? {} : 'skip'));"),
			errors: [{ messageId: 'shared', data: { query: 'api.categories.list', owner } }]
		},
		{
			filename: `${process.cwd()}/src/lib/example.svelte.ts`,
			options,
			code: "import { useQuery } from 'convex-svelte';\nconst count = useQuery(api.transactions.unapprovedCount, {});",
			errors: [{ messageId: 'shared' }]
		},
		{
			filename,
			options,
			code: `<script lang="ts">import { useQuery as subscribe } from 'convex-svelte';\nconst list = subscribe(api.payees.list, () => { return {}; });</script>`,
			languageOptions: { parser: svelteParser },
			errors: [{ messageId: 'shared', data: { query: 'api.payees.list', owner } }]
		}
	]
});
