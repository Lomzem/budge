import { matchBankRows, type MatchCandidate } from '../../src/lib/domain/matcher';

const candidates: MatchCandidate<string>[] = Array.from({ length: 1000 }, (_, i) => ({
	id: `t${String(i)}`,
	date: '2024-06-15',
	amount: -100,
	cleared: false,
	linkedSources: []
}));
for (const count of [13, 125, 250, 500, 1000]) {
	const rows = Array.from({ length: count }, (_, i) => ({
		date: '2024-06-15',
		amount: -100,
		bankText: `Invented ${String(i)}`,
		pick: 'new' as const
	}));
	const times: number[] = [];
	for (let run = 0; run < 3; run++) {
		const start = performance.now();
		matchBankRows('csv', rows, { knownImportIds: new Set(), candidates });
		times.push(performance.now() - start);
	}
	console.log(count, times.map((t) => t.toFixed(0)).join(' ms, ') + ' ms');
}
