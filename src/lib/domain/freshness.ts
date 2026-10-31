// How long ago a Bank Connection last synced, in the sidebar's words.

const UNITS = [
	['day', 24 * 60 * 60_000],
	['hour', 60 * 60_000],
	['minute', 60_000]
] as const;

/** "Synced 2 hours ago", rounded down to the largest whole unit; "Never synced" before the first. */
export function formatSynced(lastSyncedAt: number | null, now: number): string {
	if (lastSyncedAt === null) return 'Never synced';
	const elapsed = now - lastSyncedAt;
	for (const [unit, ms] of UNITS) {
		const count = Math.floor(elapsed / ms);
		if (count >= 1) return `Synced ${String(count)} ${unit}${count === 1 ? '' : 's'} ago`;
	}
	return 'Synced just now';
}
