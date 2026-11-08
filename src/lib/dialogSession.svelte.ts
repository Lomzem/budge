export class DialogSession<Session extends object> {
	#current: Session | null = $state(null);

	get current(): Session | null {
		return this.#current;
	}

	open(session: Session): Session {
		this.#current = session;
		return this.#current;
	}

	close(session: Session) {
		if (this.#current === session) this.#current = null;
	}

	dismiss() {
		this.#current = null;
	}
}
