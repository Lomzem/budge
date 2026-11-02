// How fresh a Bank Connection is: how long ago it last synced, in the sidebar's words, and when it
// needs the owner's eye.

/** After this long without a successful sync, the sidebar warns. */
const OVERDUE_MS = 48 * 60 * 60_000;
/** From this long before the bank's consent ends, the sidebar asks the owner to renew it. */
const RENEWAL_NOTICE_MS = 14 * 24 * 60 * 60_000;

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

/** Whether more than 48 hours have passed since the last successful sync. Never synced is not. */
export function isSyncOverdue(lastSyncedAt: number | null, now: number): boolean {
	return lastSyncedAt !== null && now - lastSyncedAt > OVERDUE_MS;
}

/** When consent ends, from 14 days before it on; `null` before then or with no consent end. */
export function renewalDue(consentExpiresAt: number | null, now: number): number | null {
	if (consentExpiresAt === null || consentExpiresAt - now > RENEWAL_NOTICE_MS) return null;
	return consentExpiresAt;
}
