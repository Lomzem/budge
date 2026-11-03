import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

function spread(values, digits = 0) {
	if (values.length === 0) return 'unavailable';
	const low = Math.min(...values).toFixed(digits);
	const high = Math.max(...values).toFixed(digits);
	return low === high ? low : `${low}–${high}`;
}

export function writeReport(records, out) {
	const groups = Map.groupBy(records, (row) => `${row.scenario}|${row.count}|${row.function}`);
	const lines = [
		'# Capacity observations',
		'',
		'Counts/bytes use transaction metrics from completed calls. Failed calls have no final transaction metrics; their partial execution usage is retained in runs.json. Duration is total backend wall time in seconds, including database waits. Ranges show min–max, with identical endpoints collapsed.',
		'',
		'| Scenario | Rows | Function | Success/runs | Docs read | Docs written | Bytes read | Bytes written | Index ranges | Duration (s), all runs |',
		'| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
	];
	for (const rows of groups.values()) {
		const first = rows[0];
		const ok = rows.filter((row) => !row.error);
		const metrics = [
			'documentsRead',
			'documentsWritten',
			'bytesRead',
			'bytesWritten',
			'databaseQueries'
		].map((key) => spread(ok.map((row) => row.result.metrics[key].used)));
		lines.push(
			`| ${first.scenario} | ${first.count} | ${first.function} | ${ok.length}/${rows.length} | ${metrics.join(' | ')} | ${spread(
				rows.map((row) => row.completion.executionTime),
				3
			)} |`
		);
	}
	writeFileSync(join(out, 'table.md'), lines.join('\n') + '\n');
}
