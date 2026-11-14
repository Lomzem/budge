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
import { capacityPassed, limits } from './limits.ts';
import { loadavg, cpus, freemem } from 'node:os';
import { MAX_FILE_ROWS } from '../../convex/lib/imports.ts';
import { LATER_CUTOVER_READS } from '../../convex/lib/laterCutover.ts';
import { BULK_CATEGORIZE_LIMIT } from '../../src/lib/domain/bulkCategorize.ts';

const checkMode = process.argv[2] === '--check';
const started = performance.now();

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

async function seed(count, history, diverse = false) {
	await emptyEveryTable(checkout, deployment);
	const ids = await call('initialize');
	const size = history ? count : 1000;
	for (let start = 0; start < size; start += 100) {
		const batch = Math.min(100, size - start);
		const receipt = await call('prepare', {
			...ids,
			start,
			count: batch,
			history,
			diverse,
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

async function importTrial(source, count, run, phase, diverse = false) {
	const ids = await seed(count, false, diverse);
	const rows = Array.from({ length: count }, (_, i) => ({
		date: diverse ? diverseDate(i) : '2024-06-15',
		amount: -100,
		bankText: `Invented Capacity ${String(i).padStart(6, '0')} `.padEnd(500, 'x'),
		pick: 'new',
		...(source === 'qfx' ? { sourceId: `invented-${i}` } : {})
	}));
	const input = { accountId: ids.accountId, source, rows };
	const preview = await measured(
		'preview',
		{ input },
		diverse ? `${source}-diverse` : source,
		count,
		run,
		true
	);
	if (
		!preview.error &&
		(preview.result.result.length !== count ||
			preview.result.result.some((row) => row.kind !== 'new'))
	)
		throw new Error('preview skipped work');
	const commit = await measured(
		'commit',
		{ input },
		diverse ? `${source}-diverse` : source,
		count,
		run
	);
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

const sameCounts = (a, b) =>
	JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

function cutoverShapes() {
	const R = LATER_CUTOVER_READS;
	const common = {
		assignments: R.earlierAssignments,
		totals: R.monthlyTotals - 100,
		bankRows: R.bankRows
	};
	const accounts = Math.min(R.accounts, R.transactions);
	const pairs = Math.floor(R.transactions / 20);
	return [
		{
			name: 'startingBalances',
			accounts,
			transferPairs: 0,
			others: R.transactions - accounts,
			lines: 0,
			...common
		},
		{
			name: 'splitLines',
			accounts: 10,
			transferPairs: pairs,
			others: R.transactions - 10 - 2 * pairs,
			lines: R.splitLines,
			...common
		}
	];
}

async function seedCutover(shape) {
	await emptyEveryTable(checkout, deployment);
	await call('cutoverBase', { accounts: shape.accounts });
	for (let start = 0; start < shape.assignments; start += 1000)
		await call('cutoverAssignments', {
			start,
			count: Math.min(1000, shape.assignments - start)
		});
	const history = shape.transferPairs + shape.others;
	for (let start = 0; start < history; start += 50)
		await call('cutoverHistory', {
			start,
			count: Math.min(50, history - start),
			transferPairs: shape.transferPairs,
			lines: shape.lines,
			bankRows: shape.bankRows,
			others: shape.others
		});
	await call('rebuild');
	const rebuilt = (await call('totals', {}, true)).rows;
	for (let start = 0; start < shape.totals - rebuilt; start += 1000)
		await call('cutoverTotalsFill', {
			start,
			count: Math.min(1000, shape.totals - rebuilt - start)
		});
	const seeded = await call('cutoverState', {}, true);
	save(`cutover-seeded-${shape.name}.json`, { shape, seeded });
	const expected = {
		cutoverDate: '2020-01-01',
		transactions: shape.accounts + 2 * shape.transferPairs + shape.others,
		splitLines: shape.lines,
		linkedBankRows: shape.bankRows,
		assignments: shape.assignments,
		totals: Math.max(rebuilt, shape.totals)
	};
	if (!sameCounts(seeded, expected))
		throw new Error(`cutover seed differs: ${JSON.stringify(seeded)}`);
	return seeded;
}

async function cutoverTrial(shape, run) {
	const seeded = await seedCutover(shape);
	const today = new Date().toISOString().slice(0, 10);
	const scenario = `cutover-${shape.name}`;
	const count = seeded.transactions;
	const preview = await measured('cutoverPreview', { today }, scenario, count, run, true);
	if (preview.error || preview.result.result.kind !== 'ready')
		throw new Error(
			`cutover preview not ready: ${preview.error ?? JSON.stringify(preview.result.result).slice(0, 300)}`
		);
	const { fingerprint } = preview.result.result;
	const apply = await measured('cutoverApply', { today, fingerprint }, scenario, count, run);
	const applied = await call('cutoverState', {}, true);
	save(`cutover-applied-${shape.name}-${run}.json`, applied);
	if (apply.error) return [preview, apply];
	if (applied.cutoverDate !== '2024-01-01' || applied.transactions !== shape.accounts)
		throw new Error(`apply skipped work: ${JSON.stringify(applied)}`);
	const undo = await measured('cutoverUndo', { moveId: apply.result.result }, scenario, count, run);
	const undone = await call('cutoverState', {}, true);
	save(`cutover-undone-${shape.name}-${run}.json`, undone);
	if (!undo.error && !sameCounts(undone, seeded))
		throw new Error(`undo did not restore the seeded counts: ${JSON.stringify(undone)}`);
	return [preview, apply, undo];
}

async function cutoverCapacity(runs) {
	const measuredRecords = [];
	for (const shape of cutoverShapes())
		for (let run = 1; run <= runs; run++) measuredRecords.push(...(await cutoverTrial(shape, run)));
	return {
		passed: capacityPassed(measuredRecords),
		belowHalf: measuredRecords.every(belowHalf),
		bounds: LATER_CUTOVER_READS
	};
}

async function bulkTrial(count, run) {
	await emptyEveryTable(checkout, deployment);
	const { accountId, categoryId } = await call('initialize');
	const bulkCategoryId = await call('bulkBase', { categoryId });
	for (let start = 0; start < count; start += 100) {
		await call('bulkRows', {
			accountId,
			categoryId,
			start,
			count: Math.min(100, count - start)
		});
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	await call('rebuild');
	const transactionIds = await call('bulkIds', {}, true);
	const seeded = await call('bulkState', { categoryId: bulkCategoryId }, true);
	const expectedSeed = { inCategory: 0, unapproved: count, totalsInCategory: 0 };
	if (transactionIds.length !== count || !sameCounts(seeded, expectedSeed))
		throw new Error(`bulk seed differs: ${JSON.stringify(seeded)}`);
	const scenario = 'bulk-categorize';
	const categorize = await measured(
		'bulkCategorize',
		{ transactionIds, categoryId: bulkCategoryId },
		scenario,
		count,
		run
	);
	if (categorize.error) return [categorize];
	const changed = await call('bulkState', { categoryId: bulkCategoryId }, true);
	save(`bulk-categorized-${count}-${run}.json`, changed);
	if (
		categorize.result.result.changes.length !== count ||
		!sameCounts(changed, { inCategory: count, unapproved: 0, totalsInCategory: count })
	)
		throw new Error(`bulk categorize skipped work: ${JSON.stringify(changed)}`);
	const undo = await measured(
		'bulkUndo',
		{ record: categorize.result.result },
		scenario,
		count,
		run
	);
	const undone = await call('bulkState', { categoryId: bulkCategoryId }, true);
	save(`bulk-undone-${count}-${run}.json`, undone);
	if (!undo.error && (undo.result.result.restored !== count || !sameCounts(undone, expectedSeed)))
		throw new Error(`bulk undo did not restore the seed: ${JSON.stringify(undone)}`);
	return [categorize, undo];
}

async function bulkCapacity(count, runs) {
	const measuredRecords = [];
	for (let run = 1; run <= runs; run++) measuredRecords.push(...(await bulkTrial(count, run)));
	return {
		passed: capacityPassed(measuredRecords),
		belowHalf: measuredRecords.every(belowHalf),
		transactions: count
	};
}

async function trials(scenario, count, phase = 'workflow', evaluated = []) {
	const judged = (row) =>
		row.scenario === scenario &&
		row.count === count &&
		(phase !== 'commit' || row.function === 'commit');
	const existing = records.filter(judged);
	const needed = phase === 'commit' || scenario === 'history' ? 3 : 6;
	if (existing.length === needed) {
		evaluated.push(...existing);
		return existing.every(belowHalf);
	}
	const firstMeasurement = records.length;
	const results = [];
	for (let run = 1; run <= 3; run++)
		results.push(
			await (scenario === 'history'
				? rebuildTrial(count, run)
				: importTrial(scenario, count, run, phase))
		);
	evaluated.push(...records.slice(firstMeasurement).filter(judged));
	return results.every(Boolean);
}

async function searchImport(source, phase) {
	const evaluated = [];
	const result = (rows, bound) => ({
		rows,
		bound,
		errors: evaluated.filter((record) => record.error).length
	});
	if (await trials(source, MAX_FILE_ROWS, phase, evaluated))
		return result(MAX_FILE_ROWS, 'validator');
	let low = 0;
	let high = MAX_FILE_ROWS;
	while (high - low > 1) {
		const mid = Math.floor((high + low) / 2);
		if (await trials(source, mid, phase, evaluated)) low = mid;
		else high = mid;
	}
	return result(low, 'resource-headroom');
}

function diverseDate(i) {
	return `${2020 + Math.floor((i % 60) / 12)}-${String((i % 12) + 1).padStart(2, '0')}-15`;
}

async function checkCapacity() {
	for (const source of ['qfx', 'csv']) {
		for (const diverse of [false, true]) {
			for (let run = 1; run <= 3; run++)
				await importTrial(source, MAX_FILE_ROWS, run, 'workflow', diverse);
		}
	}
	const passed = capacityPassed(records);
	if (!passed) {
		console.error(
			'Import capacity contract failed; reduce MAX_FILE_ROWS or reduce measured preview/commit work.'
		);
		process.exitCode = 1;
	}
	const cutover = await cutoverCapacity(1);
	if (!cutover.passed) {
		console.error(
			'Later cutover capacity contract failed; reduce LATER_CUTOVER_READS or reduce measured preview/apply/undo work.'
		);
		process.exitCode = 1;
	}
	const bulk = await bulkCapacity(BULK_CATEGORIZE_LIMIT, 1);
	if (!bulk.passed) {
		console.error(
			'Bulk categorize capacity contract failed; reduce BULK_CATEGORIZE_LIMIT or reduce measured categorize/undo work.'
		);
		process.exitCode = 1;
	}
	return {
		passed: passed && cutover.passed && bulk.passed,
		maxFileRows: MAX_FILE_ROWS,
		cutover,
		bulk,
		seconds: (performance.now() - started) / 1000
	};
}

const [scenario, countText] = checkMode ? [] : process.argv.slice(2);
const count = Number(countText);
if (
	scenario !== undefined &&
	scenario !== 'cutover' &&
	(!['qfx', 'csv', 'history', 'bulk'].includes(scenario) ||
		!Number.isSafeInteger(count) ||
		count < 1 ||
		(scenario === 'history' && count % 60 !== 0) ||
		(['qfx', 'csv'].includes(scenario) && count > MAX_FILE_ROWS) ||
		(scenario === 'bulk' && count > BULK_CATEGORIZE_LIMIT))
)
	throw new Error(
		`usage: bun run capacity [qfx|csv|history|bulk COUNT | cutover]; imports admit at most ${MAX_FILE_ROWS} rows, bulk categorize at most ${BULK_CATEGORIZE_LIMIT}`
	);
save('manifest.json', {
	limits,
	sourceHead: git(checkout, 'rev-parse', 'HEAD').trim(),
	decision: checkMode
		? 'Admitted MAX_FILE_ROWS preview and commit below full limits, three fresh runs at dense and diverse dates'
		: 'Every measured transaction resource strictly below 50%, three fresh runs',
	backendVersion: await (await fetch(`${deployment.url}/version`)).text()
});
try {
	await deployHarness();
	const summary = {};
	if (checkMode) summary.check = await checkCapacity();
	else if (scenario === 'cutover') summary.cutover = await cutoverCapacity(3);
	else if (scenario === 'bulk') summary.bulk = await bulkCapacity(count, 3);
	else if (scenario !== undefined) summary[scenario] = await trials(scenario, count);
	else {
		for (const source of ['qfx', 'csv'])
			summary[source] = {
				workflow: await searchImport(source, 'workflow'),
				commit: await searchImport(source, 'commit')
			};
		summary.history9000 = await trials('history', 9000);
	}
	save('summary.json', summary);
	appendFileSync(
		join(out, 'table.md'),
		`\n## Summary\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`
	);
	console.log(JSON.stringify(summary));
} finally {
	try {
		const code = await runConvex(deployment, checkout, [
			'dev',
			'--once',
			'--typecheck',
			'disable',
			'--codegen',
			'disable'
		]).catch((cause) => {
			console.error(`restoring original functions failed: ${cause}`);
			return 1;
		});
		if (code !== 0) {
			console.error(`restoring original functions exit ${code}`);
			process.exitCode = 1;
		}
		try {
			writeFileSync(join(checkout, '.env.local'), originalEnv, { mode: 0o600 });
		} finally {
			save('restore.json', {
				exitCode: code,
				originalEnvRestored: readFileSync(join(checkout, '.env.local')).equals(originalEnv)
			});
		}
	} finally {
		if (existsSync(runtime)) rmSync(runtime, { recursive: true, force: true });
	}
}
