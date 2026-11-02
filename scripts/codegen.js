// Convex 1.48's normal codegen contacts a deployment for component analysis.
// This app has no components: the system-UDF path generates its API/data model offline.
// That path omits typed env declarations, so render them with the same pinned CLI template.
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import app from '../convex/convex.config.ts';
import { version } from '../node_modules/convex/package.json';
import { serverCodegen } from '../node_modules/convex/src/cli/codegen_templates/server.ts';

// Both the CLI flag and the template import below are Convex internals, checked against this version.
const CHECKED_CONVEX_VERSION = '1.48.0';
if (version !== CHECKED_CONVEX_VERSION) {
	throw new Error(
		`Offline codegen was checked against convex ${CHECKED_CONVEX_VERSION}, found ${version}; re-check scripts/codegen.js, then bump CHECKED_CONVEX_VERSION.`
	);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const definition = app.export();
if (definition.childComponents.length > 0) {
	throw new Error(
		'Offline codegen does not support mounted components; revisit scripts/codegen.js.'
	);
}

// Ignore deployment selection entirely, including any developer deploy key or .env.local.
const env = Object.fromEntries(
	Object.entries(process.env).filter(([name]) => !name.startsWith('CONVEX_'))
);
const result = spawnSync(
	process.execPath,
	[
		'--no-env-file',
		'node_modules/convex/bin/main.js',
		'codegen',
		'--system-udfs',
		'--typecheck',
		'disable'
	],
	{ cwd: root, env: { ...env, CONVEX_DEPLOYMENT: 'anonymous:offline-codegen' }, stdio: 'inherit' }
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const server = serverCodegen({ useTypeScript: false, envVars: definition.envVars });
for (const [name, content] of [
	['server.js', server.JS],
	['server.d.ts', server.DTS]
]) {
	await writeFile(
		new URL(`../convex/_generated/${name}`, import.meta.url),
		await format(content, { parser: 'typescript' })
	);
}
