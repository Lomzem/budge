import type { FunctionReturnType } from 'convex/server';

import type { api } from '$convex/_generated/api';
import { toCsv } from '$lib/domain/csv';

export type BudgetExport = FunctionReturnType<typeof api.export.all>;

function download(name: string, type: string, text: string) {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const link = document.createElement('a');
	link.href = url;
	link.download = name;
	link.click();
	// The click starts the download synchronously, so the URL can go once it returns.
	setTimeout(() => {
		URL.revokeObjectURL(url);
	}, 0);
}

/** Downloads the whole export as one JSON file, `budge-<date>.json`. */
export function downloadJson(data: BudgetExport, date: string) {
	download(`budge-${date}.json`, 'application/json', JSON.stringify(data, null, '\t'));
}

/** Downloads one CSV file per table, `budge-<date>-<table>.csv`, empty tables included. */
export function downloadCsv(data: BudgetExport, date: string) {
	for (const [table, rows] of Object.entries(data)) {
		download(`budge-${date}-${table}.csv`, 'text/csv', toCsv(rows));
	}
}
