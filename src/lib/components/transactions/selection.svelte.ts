import { untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

import type { Id } from '$convex/_generated/dataModel';

type TransactionId = Id<'transactions'>;

export class SelectionPerScope {
	#scope = $state('');
	readonly #ids = new SvelteSet<TransactionId>();
	readonly #scopeOf: () => string;

	constructor(scopeOf: () => string) {
		this.#scopeOf = scopeOf;
		$effect.pre(() => {
			scopeOf();
			untrack(() => {
				this.#ids.clear();
			});
		});
	}

	has(id: TransactionId): boolean {
		return this.#scope === this.#scopeOf() && this.#ids.has(id);
	}

	set(ids: readonly TransactionId[], picked: boolean) {
		const scope = this.#scopeOf();
		if (scope !== this.#scope) {
			this.#ids.clear();
			this.#scope = scope;
		}
		for (const id of ids) {
			if (picked) this.#ids.add(id);
			else this.#ids.delete(id);
		}
	}

	clear() {
		this.#ids.clear();
	}

	of<Row extends { readonly _id: TransactionId }>(rows: readonly Row[]): Row[] {
		return rows.filter((row) => this.has(row._id));
	}
}

interface Categorizable {
	readonly splits: unknown;
	readonly transfer: unknown;
}

export function keepsItsCategory(row: Categorizable): boolean {
	return Boolean(row.splits) || Boolean(row.transfer);
}

export function keptCategoriesNote(rows: readonly Categorizable[]): string {
	const transfers = rows.filter((row) => row.transfer).length;
	const splits = rows.filter((row) => !row.transfer && row.splits).length;
	const named = [
		...(transfers === 0 ? [] : [counted(transfers, 'Transfer')]),
		...(splits === 0 ? [] : [counted(splits, 'Split')])
	];
	if (named.length === 0) return '';
	const total = transfers + splits;
	return `${named.join(' and ')} ${total === 1 ? 'keeps its Category' : 'keep their Categories'}.`;
}

export function counted(count: number, noun: string): string {
	return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}
