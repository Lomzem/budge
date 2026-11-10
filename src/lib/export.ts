import type { ConvexClient } from 'convex/browser';

import { api } from '$convex/_generated/api';
import { toCsv } from '$lib/domain/csv';
import { readAllPages } from '$lib/domain/pages';

export type BudgetExport = Record<string, Record<string, unknown>[]>;

const pageSize = 500;

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

const CHROMIUM_CSV_DOWNLOAD_SPACING_MS = 200;

function download(name: string, type: string, text: string) {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const link = document.createElement('a');
	link.href = url;
	link.download = name;
	link.click();
	setTimeout(() => {
		URL.revokeObjectURL(url);
	}, 0);
}

export function downloadJson(data: BudgetExport, date: string) {
	const name = `budge-${date}.json`;
	download(name, 'application/json', JSON.stringify(data, null, '\t'));
	return `Downloaded ${name}.`;
}

export async function downloadCsv(data: BudgetExport, date: string) {
	for (const [index, [table, rows]] of Object.entries(data).entries()) {
		if (index > 0)
			await new Promise((resolve) => setTimeout(resolve, CHROMIUM_CSV_DOWNLOAD_SPACING_MS));
		download(`budge-${date}-${table}.csv`, 'text/csv', toCsv(rows));
	}
	return `Downloaded ${String(Object.keys(data).length)} CSV files, named budge-${date}-<table>.csv.`;
}
