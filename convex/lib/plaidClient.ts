import { Context, Effect, Layer, Schedule, Schema } from 'effect';
import { FetchHttpClient, HttpClient, HttpClientRequest } from 'effect/http';

import { decodeSyncPage, type SyncPage } from '../../src/lib/domain/plaid';

// Plaid's failures, typed. None carries the request, the response body, or an underlying cause,
// because those can hold the access token, client secret, or bank data.

/** Plaid could not be reached. */
export class PlaidTransport extends Schema.TaggedError<
	PlaidTransport,
	{ readonly brand: unique symbol }
>()('PlaidTransport', {}) {}

/** An attempt, or the whole call, ran out of time. */
export class PlaidTimeout extends Schema.TaggedError<
	PlaidTimeout,
	{ readonly brand: unique symbol }
>()('PlaidTimeout', {}) {}

/** Plaid answered with something Budge can't read. */
export class PlaidDecode extends Schema.TaggedError<
	PlaidDecode,
	{ readonly brand: unique symbol }
>()('PlaidDecode', {}) {}

/** Plaid refused the call. Only its error code, HTTP status, and request ID are kept. */
export class PlaidApi extends Schema.TaggedError<PlaidApi, { readonly brand: unique symbol }>()(
	'PlaidApi',
	{
		error_code: Schema.String,
		status: Schema.Finite,
		request_id: Schema.String
	}
) {}

export type PlaidError = PlaidTransport | PlaidTimeout | PlaidDecode | PlaidApi;

export interface SyncRequest {
	accessToken: string;
	/** Where the last sync stopped; `null` on the first sync. */
	cursor: string | null;
	/** Transactions per page, 1 to 500. */
	count: number;
}

interface PlaidClientShape {
	/** One page of `/transactions/sync`. */
	readonly transactionsSync: (request: SyncRequest) => Effect.Effect<SyncPage, PlaidError>;
	/** Asks Plaid to check the bank for new Transactions now (`/transactions/refresh`). */
	readonly transactionsRefresh: (accessToken: string) => Effect.Effect<void, PlaidError>;
	/** Points the Item's webhook at `webhook` (`/item/webhook/update`). */
	readonly setWebhook: (accessToken: string, webhook: string) => Effect.Effect<void, PlaidError>;
}

export interface PlaidConfig {
	clientId: string | undefined;
	secret: string | undefined;
	/** Every deployment but production uses only Plaid Sandbox. */
	environment: 'sandbox' | 'production';
}

/** Each call: at most three attempts, 10 seconds per attempt, and 35 seconds in total. */
export const ATTEMPTS = 3;
const ATTEMPT_TIMEOUT = '10 seconds';
const CALL_TIMEOUT = '35 seconds';
const BACKOFF = Schedule.exponential('2 seconds');

/** Plaid's API, over `effect/http`. Every call is limited and retried the same way. */
export class PlaidClient extends Context.Service<PlaidClient, PlaidClientShape>()(
	'budge/PlaidClient'
) {
	/** The client over whichever `HttpClient` is provided. */
	static layer(config: PlaidConfig): Layer.Layer<PlaidClient, never, HttpClient.HttpClient> {
		return Layer.effect(
			PlaidClient,
			Effect.map(HttpClient.HttpClient, (http) => makeClient(http, config))
		);
	}

	/** The client over the runtime's `fetch`. */
	static layerLive(config: PlaidConfig): Layer.Layer<PlaidClient> {
		return PlaidClient.layer(config).pipe(Layer.provide(FetchHttpClient.layer));
	}

	/**
	 * A client that never touches the network. Each call does what `fake` says, and a call it
	 * leaves out is a defect, so a test sees any call it didn't expect.
	 */
	static layerTest(fake: Partial<PlaidClientShape>): Layer.Layer<PlaidClient> {
		const unexpected = (name: string) => () =>
			Effect.die(new Error(`Unexpected PlaidClient.${name} call`));
		return Layer.succeed(PlaidClient, {
			transactionsSync: fake.transactionsSync ?? unexpected('transactionsSync'),
			transactionsRefresh: fake.transactionsRefresh ?? unexpected('transactionsRefresh'),
			setWebhook: fake.setWebhook ?? unexpected('setWebhook')
		});
	}
}

const PlaidErrorBody = Schema.Struct({ error_code: Schema.String, request_id: Schema.String });

function makeClient(http: HttpClient.HttpClient, config: PlaidConfig): PlaidClientShape {
	const baseUrl = `https://${config.environment}.plaid.com`;

	const post = <A>(
		path: string,
		body: Record<string, unknown>,
		decode: (body: unknown) => Effect.Effect<A, unknown>
	): Effect.Effect<A, PlaidError> => {
		const { clientId, secret } = config;
		if (clientId === undefined || secret === undefined) {
			return Effect.die(new Error('PLAID_CLIENT_ID and PLAID_SECRET are not set'));
		}
		const request = HttpClientRequest.post(`${baseUrl}${path}`).pipe(
			HttpClientRequest.setHeaders({ 'PLAID-CLIENT-ID': clientId, 'PLAID-SECRET': secret }),
			HttpClientRequest.bodyJsonUnsafe(body)
		);
		const attempt = Effect.gen(function* () {
			const response = yield* http
				.execute(request)
				.pipe(Effect.mapError(() => new PlaidTransport()));
			const json: unknown = yield* response.json.pipe(Effect.mapError(() => new PlaidDecode()));
			if (response.status >= 200 && response.status < 300) {
				return yield* decode(json).pipe(Effect.mapError(() => new PlaidDecode()));
			}
			const error = yield* Schema.decodeUnknownEffect(PlaidErrorBody)(json).pipe(
				Effect.mapError(() => new PlaidDecode())
			);
			return yield* new PlaidApi({ ...error, status: response.status });
		});
		return attempt.pipe(
			Effect.timeoutOrElse({
				duration: ATTEMPT_TIMEOUT,
				orElse: () => Effect.fail(new PlaidTimeout())
			}),
			Effect.retry({ times: ATTEMPTS - 1, schedule: BACKOFF, while: isRetryable }),
			Effect.timeoutOrElse({
				duration: CALL_TIMEOUT,
				orElse: () => Effect.fail(new PlaidTimeout())
			})
		);
	};

	const ignoreBody = () => Effect.void;

	return {
		transactionsSync: ({ accessToken, cursor, count }) =>
			post(
				'/transactions/sync',
				{
					access_token: accessToken,
					...(cursor === null ? {} : { cursor }),
					count,
					options: { include_original_description: true }
				},
				decodeSyncPage
			),
		transactionsRefresh: (accessToken) =>
			post('/transactions/refresh', { access_token: accessToken }, ignoreBody),
		setWebhook: (accessToken, webhook) =>
			post('/item/webhook/update', { access_token: accessToken, webhook }, ignoreBody)
	};
}

/**
 * Short-lived failures are worth another attempt: no answer, or Plaid's own outage or rate limit.
 * A refusal such as a needed login, or a response Budge can't read, would only fail again.
 */
function isRetryable(error: PlaidError): boolean {
	switch (error._tag) {
		case 'PlaidTransport':
		case 'PlaidTimeout':
			return true;
		case 'PlaidApi':
			return error.status >= 500 || error.status === 429;
		case 'PlaidDecode':
			return false;
	}
}
