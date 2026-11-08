import type { HeldAccount } from '$lib/bankConnections.svelte';

export function labelOf(account: Pick<HeldAccount, 'name' | 'mask'>) {
	const name = account.name ?? 'An unnamed bank Account';
	return account.mask === null ? name : `${name} ending ${account.mask}`;
}

export function rowsOf(account: Pick<HeldAccount, 'rows' | 'moreRows'>) {
	const count = `${account.rows.toLocaleString()}${account.moreRows ? ' or more' : ''}`;
	return account.rows === 1 && !account.moreRows
		? '1 transaction waiting'
		: `${count} transactions waiting`;
}
