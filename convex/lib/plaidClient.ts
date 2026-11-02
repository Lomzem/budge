import { Context, Effect, Layer, Schedule, Schema } from 'effect';
import { FetchHttpClient, HttpClient, HttpClientRequest } from 'effect/http';

import { decodeSyncPage, type SyncPage } from '../../src/lib/domain/plaid';

export class PlaidTransport extends Schema.TaggedError<
	PlaidTransport,
	{ readonly brand: unique symbol }
>()('PlaidTransport', {}) {}

export class PlaidTimeout extends Schema.TaggedError<
	PlaidTimeout,
	{ readonly brand: unique symbol }
>()('PlaidTimeout', {}) {}

export class PlaidDecode extends Schema.TaggedError<
	PlaidDecode,
	{ readonly brand: unique symbol }
>()('PlaidDecode', {}) {}

export class PlaidApi extends Schema.TaggedError<PlaidApi, { readonly brand: unique symbol }>()(
	'PlaidApi',
	{
		error_code: Schema.String,
		status: Schema.Finite,
		request_id: Schema.String
	}
) {}

export type PlaidError = PlaidTransport | PlaidTimeout | PlaidDecode | PlaidApi;

export const PLAID_MIN_SYNC_COUNT = 1;
export const PLAID_MAX_SYNC_COUNT = 500;

export interface SyncRequest {
	accessToken: string;

	cursor: string | null;

	count: number;
}

interface PlaidClientShape {
	readonly transactionsSync: (request: SyncRequest) => Effect.Effect<SyncPage, PlaidError>;

	readonly transactionsRefresh: (accessToken: string) => Effect.Effect<void, PlaidError>;

	readonly setWebhook: (accessToken: string, webhook: string) => Effect.Effect<void, PlaidError>;
}

export interface PlaidConfig {
	clientId: string | undefined;
	secret: string | undefined;

	environment: 'sandbox' | 'production';
}

export const ATTEMPTS = 3;
const ATTEMPT_TIMEOUT = '10 seconds';
const CALL_TIMEOUT = '35 seconds';
const BACKOFF = Schedule.exponential('2 seconds');

export class PlaidClient extends Context.Service<PlaidClient, PlaidClientShape>()(
	'budge/PlaidClient'
) {
	static layer(config: PlaidConfig): Layer.Layer<PlaidClient, never, HttpClient.HttpClient> {
		return Layer.effect(
			PlaidClient,
			Effect.map(HttpClient.HttpClient, (http) => makeClient(http, config))
		);
	}

	static layerLive(config: PlaidConfig): Layer.Layer<PlaidClient> {
		return PlaidClient.layer(config).pipe(Layer.provide(FetchHttpClient.layer));
	}

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
			return Effect.fail(new PlaidTransport());
		}
		const request = HttpClientRequest.post(`${baseUrl}${path}`).pipe(
			HttpClientRequest.setHeaders({ 'PLAID-CLIENT-ID': clientId, 'PLAID-SECRET': secret }),
			HttpClientRequest.bodyJsonUnsafe(body)
		);
		const attempt = Effect.gen(function* () {
			const response = yield* http
				.execute(request)
				.pipe(Effect.mapError(() => new PlaidTransport()));
			if (response.status >= 200 && response.status < 300) {
				return yield* response.json.pipe(
					Effect.flatMap(decode),
					Effect.mapError(() => new PlaidDecode())
				);
			}
			const refusalKnownByStatusAlone = {
				error_code: `HTTP_${String(response.status)}`,
				request_id: ''
			};
			const error = yield* response.json.pipe(
				Effect.flatMap(Schema.decodeUnknownEffect(PlaidErrorBody)),
				Effect.orElseSucceed(() => refusalKnownByStatusAlone)
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
