const OVERDUE_MS = 48 * 60 * 60_000;
const RENEWAL_NOTICE_MS = 14 * 24 * 60 * 60_000;

const UNITS = [
	['day', 24 * 60 * 60_000],
	['hour', 60 * 60_000],
	['minute', 60_000]
] as const;

export function formatAgo(at: number, now: number): string {
	const elapsed = now - at;
	for (const [unit, ms] of UNITS) {
		const count = Math.floor(elapsed / ms);
		if (count >= 1) return `${String(count)} ${unit}${count === 1 ? '' : 's'} ago`;
	}
	return 'just now';
}

export function formatSynced(lastSyncedAt: number | null, now: number): string {
	if (lastSyncedAt === null) return 'Never synced';
	return `Synced ${formatAgo(lastSyncedAt, now)}`;
}

export function isSyncOverdue(lastSyncedAt: number | null, now: number): boolean {
	return lastSyncedAt !== null && now - lastSyncedAt > OVERDUE_MS;
}

export function renewalDue(consentExpiresAt: number | null, now: number): number | null {
	if (consentExpiresAt === null || consentExpiresAt - now > RENEWAL_NOTICE_MS) return null;
	return consentExpiresAt;
}
