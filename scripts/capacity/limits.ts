export const limits = {
	bytesRead: 16777216,
	bytesWritten: 16777216,
	documentsRead: 32000,
	documentsWritten: 16000,
	databaseQueries: 4096
};

interface CapacityRecord {
	error?: string;
	result: { metrics: Record<string, { used: number }> };
	completion: { returnBytes: number };
}

function withinLimits(record: CapacityRecord) {
	return (
		!record.error &&
		Object.entries(limits).every(
			([key, limit]) => (record.result.metrics[key]?.used ?? Infinity) < limit
		) &&
		record.completion.returnBytes < 16777216
	);
}

export function capacityPassed(records: CapacityRecord[]) {
	return records.length > 0 && records.every(withinLimits);
}
