import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { chromium, type Browser, type Download, type Page } from '@playwright/test';

import { journeys, type NamedJourney } from '../../e2e/journeys';
import { findCheckout, git } from '../local/checkout';
import { requireLocalAnonymousDeployment } from '../local/deployment';
import { redact } from '../local/redaction';
import { findFixture } from './fixtures';
import { liveApp } from './owned';
import { loadFixture } from './seed';
import { storageStatePath } from './state';
import type { Verb } from './verb';

const JOURNEY_TIMEOUT_MS = 120_000;
const RUN_NAME = /^[\w.-]+$/;

interface StepRecord {
	name: string;
	result: 'passed' | 'failed';
	screenshot: string;
	aria?: string;
}

interface JourneyRecord {
	name: string;
	title: string;
	fixture: string;
	result: 'passed' | 'failed';
	steps: StepRecord[];
	trace: string;
	error?: string;
}

function listJourneys() {
	const width = Math.max(...journeys.map((journey) => journey.name.length));
	for (const journey of journeys) {
		console.log(`${journey.name.padEnd(width)}  ${journey.title} [${journey.fixture}]`);
	}
}

function parseArgs(args: string[]) {
	const names: string[] = [];
	let run: string | undefined;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === '--run') {
			run = args[++index];
			if (run === undefined || !RUN_NAME.test(run)) {
				throw new Error('--run takes a name of letters, digits, ".", "_" or "-".');
			}
		} else if (arg !== undefined) {
			names.push(arg);
		}
	}
	return { names, run: run ?? new Date().toISOString().replaceAll(':', '-') };
}

function selectJourneys(names: string[]) {
	if (names.length === 0) {
		throw new Error('name at least one journey. See `bun run app verify --list`.');
	}
	const byName = new Map(journeys.map((journey) => [journey.name, journey]));
	const unknown = names.filter((name) => !byName.has(name));
	if (unknown.length > 0) {
		throw new Error(`no journey named ${unknown.join(', ')}. See \`bun run app verify --list\`.`);
	}
	return names.flatMap((name) => byName.get(name) ?? []);
}

function slug(text: string) {
	return text
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
}

function messageOf(error: unknown) {
	return redact(stripVTControlCharacters(error instanceof Error ? error.message : String(error)));
}

async function capture(page: Page, dir: string, base: string) {
	const screenshot = join(dir, `${base}.png`);
	await page.screenshot({ path: screenshot, fullPage: true });
	const aria = join(dir, `${base}.aria.yml`);
	writeFileSync(aria, await page.locator('body').ariaSnapshot());
	return { screenshot, aria };
}

function timeout(ms: number) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const expired = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			reject(new Error(`the journey took longer than ${String(ms / 1000)} s.`));
		}, ms);
	});
	return {
		expired,
		cancel: () => {
			clearTimeout(timer);
		}
	};
}

async function runJourney(
	browser: Browser,
	journey: NamedJourney,
	options: { checkout: string; appUrl: string; storageState: string; runDir: string }
): Promise<JourneyRecord> {
	const fixture = findFixture(journey.fixture);
	if (fixture === undefined) throw new Error(`No fixture named ${journey.fixture}.`);
	await loadFixture(
		options.checkout,
		requireLocalAnonymousDeployment(options.checkout, 'verify'),
		fixture
	);

	const dir = join(options.runDir, journey.name);
	mkdirSync(dir, { recursive: true });
	const trace = join(dir, 'trace.zip');
	const record: JourneyRecord = {
		name: journey.name,
		title: journey.title,
		fixture: journey.fixture,
		result: 'passed',
		steps: [],
		trace
	};
	const context = await browser.newContext({
		baseURL: options.appUrl,
		viewport: { width: 1280, height: 800 }
	});
	await context.setStorageState(options.storageState);
	await context.tracing.start({
		title: journey.name,
		screenshots: true,
		snapshots: { aria: true, screen: true }
	});
	const page = await context.newPage();
	const step = async <T>(name: string, body: () => Promise<T>) => {
		const base = `${String(record.steps.length + 1).padStart(2, '0')}-${slug(name)}`;
		await context.tracing.group(name);
		try {
			const value = await body();
			record.steps.push({ name, result: 'passed', ...(await capture(page, dir, base)) });
			return value;
		} catch (error) {
			const failed = await capture(page, dir, `${base}-failed`).catch(() => undefined);
			record.steps.push({
				name,
				result: 'failed',
				screenshot: failed?.screenshot ?? '',
				...(failed === undefined ? {} : { aria: failed.aria })
			});
			throw error;
		} finally {
			await context.tracing.groupEnd();
		}
	};

	const keepAsEvidence = async (download: Download) => {
		const path = join(dir, 'downloads', download.suggestedFilename());
		await download.saveAs(path);
		return path;
	};

	const limit = timeout(JOURNEY_TIMEOUT_MS);
	const running = journey.run(page, { step, keepAsEvidence });
	running.catch(() => undefined);
	try {
		await Promise.race([running, limit.expired]);
	} catch (error) {
		record.result = 'failed';
		record.error = messageOf(error);
		if (!record.steps.some((recorded) => recorded.result === 'failed')) {
			const failed = await capture(page, dir, 'failed').catch(() => undefined);
			if (failed !== undefined) record.steps.push({ name: 'failure', result: 'failed', ...failed });
		}
	} finally {
		limit.cancel();
		await context.tracing.stop({ path: trace }).catch(() => undefined);
		await context.close();
	}
	return record;
}

export const verify: Verb = {
	usage: 'bun run app verify <journey>... [--run <name>] | bun run app verify --list',
	summary: 'Run named E2E journeys against the running app and keep their evidence.',
	details: [
		'--list      name every journey and the fixture it reseeds.',
		'--run NAME  name the evidence directory (default: the start time). Refuses one that exists.',
		'Needs `up` and `login`. Reseeds the local backend with each journey’s fixture before it runs.',
		'Writes a screenshot and ARIA snapshot per step, a trace.zip and kept downloads per journey, and summary.json to',
		'test-results/verify-budge/<run>/, which `down` keeps. Exits non-zero if any journey fails.'
	].join('\n'),
	run: async (args) => {
		if (args.includes('--list')) {
			listJourneys();
			return;
		}
		const { names, run } = parseArgs(args);
		const selected = selectJourneys(names);
		const { checkout } = findCheckout();
		const app = liveApp(checkout);
		if (app === undefined) throw new Error('the app is not up. Run `bun run app up` first.');
		const storageState = storageStatePath(checkout);
		if (!existsSync(storageState)) {
			throw new Error('no saved sign-in. Run `bun run app login` first.');
		}
		const runDir = join(checkout, 'test-results', 'verify-budge', run);
		if (existsSync(runDir)) throw new Error(`${runDir} exists; pass a new --run name.`);
		mkdirSync(runDir, { recursive: true });

		const records: JourneyRecord[] = [];
		const browser = await chromium.launch();
		try {
			for (const journey of selected) {
				const record = await runJourney(browser, journey, {
					checkout,
					appUrl: app.appUrl,
					storageState,
					runDir
				});
				records.push(record);
				console.log(
					`${record.result === 'passed' ? 'pass' : 'FAIL'}  ${record.name}${record.error === undefined ? '' : `: ${record.error.split('\n')[0] ?? ''}`}`
				);
			}
		} finally {
			await browser.close();
			const failed = records.some((record) => record.result === 'failed');
			writeFileSync(
				join(runDir, 'summary.json'),
				`${JSON.stringify(
					{
						result: failed || records.length < selected.length ? 'failed' : 'passed',
						checkout,
						commit: git(checkout, 'rev-parse', 'HEAD').trim(),
						uncommittedChanges: git(checkout, 'status', '--porcelain').trim() !== '',
						appUrl: app.appUrl,
						journeys: records
					},
					null,
					'\t'
				)}\n`
			);
			console.log(`evidence: ${runDir}`);
			if (failed) process.exitCode = 1;
		}
	}
};
