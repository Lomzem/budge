import { tick, untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

import type { Id } from '$convex/_generated/dataModel';

type TransactionId = Id<'transactions'>;

export interface SelectionMark {
	readonly generation: number;
	readonly scope: string;
}

export class SelectionPerScope {
	#generation = $state(0);
	#settling = $state(false);
	#unselected = $state<{ count: number; mark: SelectionMark } | null>(null);
	readonly #ids = new SvelteSet<TransactionId>();
	readonly #scopeOf: () => string;

	constructor(scopeOf: () => string, shownOnceLoaded: () => readonly TransactionId[] | undefined) {
		this.#scopeOf = scopeOf;
		$effect.pre(() => {
			scopeOf();
			untrack(() => {
				this.#generation += 1;
				this.#settling = this.#ids.size > 0;
			});
		});
		$effect(() => {
			if (this.#settling && shownOnceLoaded() !== undefined)
				void this.#keepOnlyShownOnceTheListQueryCaughtUp(shownOnceLoaded);
		});
	}

	async #keepOnlyShownOnceTheListQueryCaughtUp(
		shownOnceLoaded: () => readonly TransactionId[] | undefined
	) {
		await tick();
		const shown = shownOnceLoaded();
		if (!this.#settling || shown === undefined) return;
		this.#settling = false;
		const left = [...this.#ids].filter((id) => !shown.includes(id));
		if (left.length === 0) return;
		for (const id of left) this.#ids.delete(id);
		this.#generation += 1;
		this.#unselected = { count: left.length, mark: this.mark() };
	}

	get leftTheList(): { readonly count: number } | undefined {
		const note = this.#unselected;
		return note !== null && this.owns(note.mark) ? note : undefined;
	}

	has(id: TransactionId): boolean {
		return this.#ids.has(id);
	}

	set(ids: readonly TransactionId[], picked: boolean) {
		this.#generation += 1;
		for (const id of ids) {
			if (picked) this.#ids.add(id);
			else this.#ids.delete(id);
		}
	}

	clear() {
		this.#generation += 1;
		this.#settling = false;
		this.#ids.clear();
	}

	mark(): SelectionMark {
		return { generation: this.#generation, scope: this.#scopeOf() };
	}

	owns(mark: SelectionMark): boolean {
		return mark.generation === this.#generation && mark.scope === this.#scopeOf();
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
