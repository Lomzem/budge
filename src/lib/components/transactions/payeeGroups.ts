import type { Id } from '$convex/_generated/dataModel';

interface Grouped {
	readonly payeeId: Id<'payees'> | null;
	readonly payeeName: string | null;
	readonly startingBalance: boolean;
	readonly transfer: unknown;
}

export interface PayeeGroup<Row> {
	readonly key: string;
	readonly label: string;
	readonly rows: Row[];
}

const WITHOUT_A_PAYEE = [
	{ key: 'transfers', label: 'Transfers' },
	{ key: 'starting-balance', label: 'Starting Balance' },
	{ key: 'no-payee', label: 'No Payee' }
] as const;

type Without = (typeof WITHOUT_A_PAYEE)[number]['key'];

function withoutAPayee(row: Grouped): Without {
	if (row.startingBalance) return 'starting-balance';
	if (row.transfer) return 'transfers';
	return 'no-payee';
}

export function groupByPayee<Row extends Grouped>(rows: readonly Row[]): PayeeGroup<Row>[] {
	const byPayee = new Map<Id<'payees'>, { label: string; rows: Row[] }>();
	const without = new Map<Without, Row[]>();
	for (const row of rows) {
		if (row.payeeId === null) {
			const kind = withoutAPayee(row);
			without.set(kind, [...(without.get(kind) ?? []), row]);
			continue;
		}
		const group = byPayee.get(row.payeeId);
		if (group) group.rows.push(row);
		else byPayee.set(row.payeeId, { label: row.payeeName ?? '', rows: [row] });
	}
	const named = [...byPayee]
		.map(([payeeId, group]) => ({ key: payeeId, ...group }))
		.sort((one, other) =>
			one.label.localeCompare(other.label, undefined, { sensitivity: 'base', numeric: true })
		);
	const rest = WITHOUT_A_PAYEE.flatMap(({ key, label }) => {
		const grouped = without.get(key);
		return grouped === undefined ? [] : [{ key, label, rows: grouped }];
	});
	return [...named, ...rest];
}
