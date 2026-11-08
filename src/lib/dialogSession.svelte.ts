import { attempt, type Attempt } from './attempt';

interface Live<Opening, Operation extends string> {
	readonly opening: Opening;
	readonly pending: Partial<Record<Operation, number>>;
	readonly started: Partial<Record<Operation, number>>;
}

function neverSettles<A>(): Promise<A> {
	return new Promise<A>(() => undefined);
}

export class DialogSession<Opening extends object = object, Operation extends string = 'save'> {
	#live: Live<Opening, Operation> | null = $state(null);

	get current(): Opening | null {
		return this.#live?.opening ?? null;
	}

	open(opening: Opening) {
		this.#live = { opening, pending: {}, started: {} };
	}

	openOrResume(opening: Opening, operation: Operation): boolean {
		if (this.pending(operation)) return false;
		this.open(opening);
		return true;
	}

	close(opening: Opening) {
		if (this.#live?.opening === opening) this.#live = null;
	}

	dismiss() {
		this.#live = null;
	}

	pending(operation: Operation): boolean {
		return (this.#live?.pending[operation] ?? 0) > 0;
	}

	run<A>(operation: Operation, work: () => PromiseLike<A>): Promise<Attempt<A>> {
		const live = this.#live;
		if (live === null) return neverSettles();
		const run = (live.started[operation] ?? 0) + 1;
		live.started[operation] = run;
		live.pending[operation] = (live.pending[operation] ?? 0) + 1;
		return attempt(work).then((outcome) => {
			live.pending[operation] = (live.pending[operation] ?? 1) - 1;
			const latestRunOfItsOpening = this.#live === live && live.started[operation] === run;
			return latestRunOfItsOpening ? outcome : neverSettles<Attempt<A>>();
		});
	}
}
