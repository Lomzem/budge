import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { journeys } from '../../e2e/journeys';

const root = join(import.meta.dirname, '..', '..');
const featuresDir = join(root, '.agents', 'skills', 'verify-budge', 'features');
const convexDir = join(root, 'convex');

const featureMaps = new Map(
	readdirSync(featuresDir)
		.filter((file) => file.endsWith('.md') && file !== 'README.md')
		.map((file) => [basename(file, '.md'), readFileSync(join(featuresDir, file), 'utf8')])
);

function namedInMaps(pattern: RegExp) {
	return [...featureMaps.values()].flatMap((text) => [...text.matchAll(pattern)]);
}

async function publicConvexFunctions() {
	const modules = readdirSync(convexDir).filter(
		(file) => file.endsWith('.ts') && !/\.(test|helper|config)\.ts$/.test(file)
	);
	const names: string[] = [];
	for (const file of modules) {
		const exports = (await import(join(convexDir, file))) as Record<string, unknown>;
		for (const [name, value] of Object.entries(exports)) {
			if (typeof value === 'function' && (value as { isPublic?: boolean }).isPublic === true) {
				names.push(`${basename(file, '.ts')}.${name}`);
			}
		}
	}
	return names;
}

describe('the verify-budge feature map', () => {
	test('names every public Convex function', async () => {
		const named = new Set(
			namedInMaps(/`(\w+)\.(\w+(?:\/\w+)*)`/g).flatMap(([, module = '', functions = '']) =>
				functions.split('/').map((name) => `${module}.${name}`)
			)
		);
		const functions = await publicConvexFunctions();

		expect(functions).toContain('budget.setAssigned');
		expect(functions.filter((name) => !named.has(name))).toEqual([]);
	});

	test('lists every journey in its feature file', () => {
		const unlisted = journeys
			.filter((journey) => !featureMaps.get(journey.feature)?.includes(`\`${journey.name}\``))
			.map((journey) => journey.name);

		expect(unlisted).toEqual([]);
	});

	test('names only journeys that exist', () => {
		const features = new Set(journeys.map((journey) => journey.feature));
		const names = new Set(journeys.map((journey) => journey.name));
		const named = namedInMaps(/`([a-z-]+)\/([a-z-]+)`/g)
			.filter(([, feature = '']) => features.has(feature))
			.map(([name]) => name.slice(1, -1));

		expect(named.filter((name) => !names.has(name))).toEqual([]);
	});
});
