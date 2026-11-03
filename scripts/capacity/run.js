import {
	cpSync,
	mkdirSync,
	writeFileSync,
	symlinkSync,
	existsSync,
	rmSync,
	appendFileSync,
	readFileSync
} from 'node:fs';
import { join } from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { findCheckout, git } from '../local/checkout.ts';
import { requireLocalAnonymousDeployment } from '../local/deployment.ts';
import { loadCredentials } from '../local/credentials.ts';
import { emptyEveryTable } from '../app/reset.ts';
import { runConvex } from '../local/backend.ts';
import { writeReport } from './report.js';
import { loadavg, cpus, freemem } from 'node:os';

const { checkout, mainCheckout } = findCheckout();
const deployment = requireLocalAnonymousDeployment(checkout, 'measure capacity');
const originalEnv = readFileSync(join(checkout, '.env.local'));
const credentials = loadCredentials(mainCheckout);
const out = join(checkout, 'test-results/capacity', new Date().toISOString().replaceAll(':', '-'));
mkdirSync(out, { recursive: true });
const runtime = join(checkout, '.local-app/capacity-runtime');
const client = new ConvexHttpClient(deployment.url, { logger: false });
client.setAdminAuth(deployment.adminKey, {
	subject: credentials.E2E_CLERK_USER_ID,
	issuer: credentials.CLERK_JWT_ISSUER_DOMAIN
});
const limits = {
	bytesRead: 16777216,
	bytesWritten: 16777216,
	documentsRead: 32000,
	documentsWritten: 16000,
	databaseQueries: 4096
};
const records = [];
let cursor = 0;

function save(name, data) {
	writeFileSync(join(out, name), JSON.stringify(data, null, 2) + '\n');
}

async function call(name, args = {}, query = false) {
	const ref = makeFunctionReference(`capacity:${name}`);
	return await (query ? client.query(ref, args) : client.mutation(ref, args));
}

async function logs() {
	const response = await fetch(`${deployment.url}/api/stream_udf_execution?cursor=${cursor}`, {
		headers: { Authorization: `Convex ${deployment.adminKey}` },
		signal: AbortSignal.timeout(60000)
	});
	if (!response.ok) throw new Error(`metrics HTTP ${response.status}`);
	const body = await response.json();
	cursor = body.newCursor;
	return body.entries;
}

async function deployHarness() {
	rmSync(runtime, { recursive: true, force: true });
	mkdirSync(runtime, { recursive: true });
	cpSync(join(checkout, 'convex'), join(runtime, 'convex'), { recursive: true });
	symlinkSync(join(checkout, 'src'), join(runtime, 'src'), 'dir');
	symlinkSync(join(checkout, 'node_modules'), join(runtime, 'node_modules'), 'dir');
	cpSync(join(checkout, 'package.json'), join(runtime, 'package.json'));
	cpSync(new URL('harness.js', import.meta.url), join(runtime, 'convex/capacity.js'));
	const code = await runConvex(deployment, runtime, [
		'dev',
		'--once',
		'--typecheck',
		'disable',
		'--codegen',
		'disable'
	]);
	if (code !== 0) throw new Error(`harness deploy exit ${code}`);
}

async function seed(count, history) {
	await emptyEveryTable('measure capacity');
	const ids = await call('initialize');
	const size = history ? count : 1000;
	for (let start = 0; start < size; start += 100) {
		const batch = Math.min(100, size - start);
		const receipt = await call('prepare', {
			...ids,
			start,
			count: batch,
			history,
			perMonth: count / 60
		});
		appendFileSync(
			join(out, 'seed-receipts.jsonl'),
			JSON.stringify({ ...ids, start, count: batch, history, receipt }) + '\n'
		);
		if (receipt !== batch) throw new Error('seed skipped rows');
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	return ids;
}

async function measured(name, args, scenario, count, run, query = false) {
	let result;
	let error;
	try {
		result = await call(name, args, query);
	} catch (cause) {
		error = String(cause);
	}
	const entries = await logs();
	const completion = entries.findLast(
		(entry) => entry.identifier === `capacity.js:${name}` || entry.identifier === `capacity:${name}`
	);
	if (!completion || completion.cachedResult)
		throw new Error(
			`missing uncached ${name} receipt: ${entries.map((e) => e.identifier).join(',')}`
		);
	const record = { scenario, count, run, function: name, result, error, completion };
	records.push(record);
	save('runs.json', records);
	writeReport(records, out);
	save('host.json', { load: loadavg(), cpus: cpus().length, freeBytes: freemem() });
	console.log(
		JSON.stringify({
			scenario,
			count,
			run,
			function: name,
			error,
			metrics: result?.metrics,
			duration: completion.executionTime
		})
	);
	return record;
}

function belowHalf(record) {
	return (
		!record.error &&
		Object.entries(limits).every(([key, limit]) => record.result.metrics[key].used < limit / 2) &&
		(record.completion.returnBytes ?? Infinity) < 8388608
	);
}

async function importTrial(source, count, run, phase) {
	const ids = await seed(count, false);
	const rows = Array.from({ length: count }, (_, i) => ({
		date: '2024-06-15',
		amount: -100,
		bankText: `Invented Capacity ${String(i).padStart(6, '0')} `.padEnd(500, 'x'),
		pick: 'new',
		...(source === 'qfx' ? { sourceId: `invented-${i}` } : {})
	}));
	const input = { accountId: ids.accountId, source, rows };
	const preview = await measured('preview', { input }, source, count, run, true);
	if (
		!preview.error &&
		(preview.result.result.length !== count ||
			preview.result.result.some((row) => row.kind !== 'new'))
	)
		throw new Error('preview skipped work');
	const commit = await measured('commit', { input }, source, count, run);
	if (
		!commit.error &&
		JSON.stringify(commit.result.result) !==
			JSON.stringify({ added: count, matched: 0, skipped: 0 })
	)
		throw new Error('commit skipped work');
	return phase === 'commit' ? belowHalf(commit) : belowHalf(preview) && belowHalf(commit);
}

async function rebuildTrial(count, run) {
	await seed(count, true);
	await call('rebuild');
	const record = await measured('rebuild', {}, 'history', count, run);
	if (!record.error) {
		const totals = await call('totals', {}, true);
		save(`totals-${count}-${run}.json`, totals);
		if (totals.rows !== 60 || totals.amount !== -100 * count || totals.count !== count * 1.1)
			throw new Error('rebuild skipped or double-counted work');
	}
	return belowHalf(record);
}

async function trials(scenario, count, phase = 'workflow') {
	const existing = records.filter(
		(row) =>
			row.scenario === scenario &&
			row.count === count &&
			(phase !== 'commit' || row.function === 'commit')
	);
	const needed = phase === 'commit' || scenario === 'history' ? 3 : 6;
	if (existing.length === needed) return existing.every(belowHalf);
	const results = [];
	for (let run = 1; run <= 3; run++)
		results.push(
			await (scenario === 'history'
				? rebuildTrial(count, run)
				: importTrial(scenario, count, run, phase))
		);
	return results.every(Boolean);
}

async function searchImport(source, phase) {
	if (await trials(source, 1000, phase)) return 1000;
	let low = 0;
	let high = 1000;
	while (high - low > 1) {
		const mid = Math.floor((high + low) / 2);
		if (await trials(source, mid, phase)) low = mid;
		else high = mid;
	}
	return low;
}

const [scenario, countText] = process.argv.slice(2);
const count = Number(countText);
if (
	scenario !== undefined &&
	(!['qfx', 'csv', 'history'].includes(scenario) ||
		!Number.isSafeInteger(count) ||
		count < 1 ||
		(scenario === 'history' && count % 60 !== 0) ||
		(scenario !== 'history' && count > 1000))
)
	throw new Error('usage: bun run capacity [qfx|csv|history COUNT]');
save('manifest.json', {
	limits,
	sourceHead: git(checkout, 'rev-parse', 'HEAD').trim(),
	decision: 'Every measured transaction resource strictly below 50%, three fresh runs',
	backendVersion: await (await fetch(`${deployment.url}/version`)).text()
});
try {
	await deployHarness();
	const summary = {};
	if (scenario !== undefined) summary[scenario] = await trials(scenario, count);
	else {
		for (const source of ['qfx', 'csv'])
			summary[source] = {
				workflow: await searchImport(source, 'workflow'),
				commit: await searchImport(source, 'commit')
			};
		summary.history9000 = await trials('history', 9000);
	}
	save('summary.json', summary);
} finally {
	const code = await runConvex(deployment, checkout, [
		'dev',
		'--once',
		'--typecheck',
		'disable',
		'--codegen',
		'disable'
	]);
	writeFileSync(join(checkout, '.env.local'), originalEnv, { mode: 0o600 });
	save('restore.json', {
		exitCode: code,
		originalEnvRestored: readFileSync(join(checkout, '.env.local')).equals(originalEnv)
	});
	if (code !== 0) {
		console.error(`restoring original functions exit ${code}`);
		process.exitCode = 1;
	}
	if (existsSync(runtime)) rmSync(runtime, { recursive: true, force: true });
}
