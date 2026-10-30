import type { ConvexClient } from 'convex/browser';

import { api } from '$convex/_generated/api';
import { toCsv } from '$lib/domain/csv';
import { readAllPages } from '$lib/domain/pages';

/** Every exportable table's documents, by table name. */
export type BudgetExport = Record<string, Record<string, unknown>[]>;

// Rows per page. A page of unusually large rows splits, so this bounds only the common case.
const pageSize = 500;

/** Reads every page of every exportable table. */
export async function fetchExport(client: ConvexClient): Promise<BudgetExport> {
	const data: BudgetExport = {};
	for (const table of await client.query(api.export.tables, {})) {
		data[table] = await readAllPages(
			(paginationOpts) => client.query(api.export.page, { table, paginationOpts }),
			{ numItems: pageSize }
		);
	}
	return data;
}

/** The pause between CSV files. */
const CSV_SPACING_MS = 200;

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
export async function downloadCsv(data: BudgetExport, date: string) {
	for (const [index, [table, rows]] of Object.entries(data).entries()) {
		// Chromium drops downloads past ten started at once, so the files go one at a time.
		if (index > 0) await new Promise((resolve) => setTimeout(resolve, CSV_SPACING_MS));
		download(`budge-${date}-${table}.csv`, 'text/csv', toCsv(rows));
	}
}
