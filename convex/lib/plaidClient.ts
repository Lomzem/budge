import { Context, Duration, Effect, Layer, Schedule, Schema } from 'effect';
import { FetchHttpClient, HttpClient, HttpClientRequest } from 'effect/http';

import {
	decodeAccounts,
	decodeSyncPage,
	type BankAccount,
	type SyncPage
} from '../../src/lib/domain/plaid';

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
	readonly webhookVerificationKey: (keyId: string) => Effect.Effect<WebhookKey, PlaidError>;
	readonly linkTokenCreate: (request: LinkRequest) => Effect.Effect<string, PlaidError>;
	readonly publicTokenExchange: (publicToken: string) => Effect.Effect<LinkedItem, PlaidError>;
	readonly itemGet: (accessToken: string) => Effect.Effect<ItemState, PlaidError>;
	readonly itemRemove: (accessToken: string) => Effect.Effect<void, PlaidError>;
	readonly accountsGet: (
		accessToken: string,
		accountIds?: readonly string[]
	) => Effect.Effect<BankAccount[], PlaidError>;
}

export type LinkRequest = { clientUserId: string } & (
	{ mode: 'update'; accessToken: string } | { mode: 'create'; webhook: string }
);

export interface LinkedItem {
	accessToken: string;
	itemId: string;
}

export interface ItemState {
	consentExpiresAt: number | null;
}

export interface WebhookKey {
	kty: string;
	crv: string;
	x: string;
	y: string;
	expiredAt: number | null;
}

export interface PlaidConfig {
	clientId: string | undefined;
	secret: string | undefined;

	environment: 'sandbox' | 'production';
}

export const ATTEMPTS = 3;
const ATTEMPT_TIMEOUT = '10 seconds';
const CALL_TIMEOUT = '35 seconds';

interface CallLimits {
	attempts: number;
	attemptTimeout: Duration.Input;
}
const SAFE_TO_REPEAT: CallLimits = { attempts: ATTEMPTS, attemptTimeout: ATTEMPT_TIMEOUT };
const WITHIN_PLAIDS_WEBHOOK_DEADLINE: CallLimits = { attempts: 1, attemptTimeout: '5 seconds' };
const EXACTLY_ONCE: CallLimits = { attempts: 1, attemptTimeout: ATTEMPT_TIMEOUT };
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
			setWebhook: fake.setWebhook ?? unexpected('setWebhook'),
			webhookVerificationKey: fake.webhookVerificationKey ?? unexpected('webhookVerificationKey'),
			linkTokenCreate: fake.linkTokenCreate ?? unexpected('linkTokenCreate'),
			publicTokenExchange: fake.publicTokenExchange ?? unexpected('publicTokenExchange'),
			itemGet: fake.itemGet ?? unexpected('itemGet'),
			itemRemove: fake.itemRemove ?? unexpected('itemRemove'),
			accountsGet: fake.accountsGet ?? unexpected('accountsGet')
		});
	}
}

const WebhookKeyBody = Schema.Struct({
	key: Schema.Struct({
		kty: Schema.String,
		crv: Schema.String,
		x: Schema.String,
		y: Schema.String,
		expired_at: Schema.NullOr(Schema.Finite)
	})
});

const PlaidErrorBody = Schema.Struct({ error_code: Schema.String, request_id: Schema.String });

const LinkTokenBody = Schema.Struct({ link_token: Schema.String });

const ExchangeBody = Schema.Struct({ access_token: Schema.String, item_id: Schema.String });

const ItemGetBody = Schema.Struct({
	item: Schema.Struct({ consent_expiration_time: Schema.NullOr(Schema.String) })
});

function decodeItem(body: unknown): Effect.Effect<ItemState, unknown> {
	return Schema.decodeUnknownEffect(ItemGetBody)(body).pipe(
		Effect.flatMap(({ item }): Effect.Effect<ItemState, PlaidDecode> => {
			const at = item.consent_expiration_time;
			if (at === null) return Effect.succeed({ consentExpiresAt: null });
			const consentExpiresAt = Date.parse(at);
			return Number.isNaN(consentExpiresAt)
				? Effect.fail(new PlaidDecode())
				: Effect.succeed({ consentExpiresAt });
		})
	);
}

function makeClient(http: HttpClient.HttpClient, config: PlaidConfig): PlaidClientShape {
	const baseUrl = `https://${config.environment}.plaid.com`;

	const post = <A>(
		path: string,
		body: Record<string, unknown>,
		decode: (body: unknown) => Effect.Effect<A, unknown>,
		limits: CallLimits
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
				duration: limits.attemptTimeout,
				orElse: () => Effect.fail(new PlaidTimeout())
			}),
			Effect.retry({ times: limits.attempts - 1, schedule: BACKOFF, while: isRetryable }),
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
				decodeSyncPage,
				SAFE_TO_REPEAT
			),
		transactionsRefresh: (accessToken) =>
			post('/transactions/refresh', { access_token: accessToken }, ignoreBody, SAFE_TO_REPEAT),
		setWebhook: (accessToken, webhook) =>
			post(
				'/item/webhook/update',
				{ access_token: accessToken, webhook },
				ignoreBody,
				SAFE_TO_REPEAT
			),
		webhookVerificationKey: (keyId) =>
			post(
				'/webhook_verification_key/get',
				{ key_id: keyId },
				(body) =>
					Schema.decodeUnknownEffect(WebhookKeyBody)(body).pipe(
						Effect.map(({ key }) => ({
							kty: key.kty,
							crv: key.crv,
							x: key.x,
							y: key.y,
							expiredAt: key.expired_at
						}))
					),
				WITHIN_PLAIDS_WEBHOOK_DEADLINE
			),
		linkTokenCreate: (request) =>
			post(
				'/link/token/create',
				{
					client_name: 'Budge',
					language: 'en',
					country_codes: ['US'],
					user: { client_user_id: request.clientUserId },
					...(request.mode === 'update'
						? { access_token: request.accessToken }
						: { products: ['transactions'], webhook: request.webhook })
				},
				(body) =>
					Schema.decodeUnknownEffect(LinkTokenBody)(body).pipe(Effect.map((b) => b.link_token)),
				SAFE_TO_REPEAT
			),
		publicTokenExchange: (publicToken) =>
			post(
				'/item/public_token/exchange',
				{ public_token: publicToken },
				(body) =>
					Schema.decodeUnknownEffect(ExchangeBody)(body).pipe(
						Effect.map((b) => ({ accessToken: b.access_token, itemId: b.item_id }))
					),
				EXACTLY_ONCE
			),
		itemGet: (accessToken) =>
			post('/item/get', { access_token: accessToken }, decodeItem, SAFE_TO_REPEAT),
		itemRemove: (accessToken) =>
			post('/item/remove', { access_token: accessToken }, ignoreBody, SAFE_TO_REPEAT),
		accountsGet: (accessToken, accountIds) =>
			post(
				'/accounts/get',
				{
					access_token: accessToken,
					...(accountIds === undefined ? {} : { options: { account_ids: accountIds } })
				},
				decodeAccounts,
				SAFE_TO_REPEAT
			)
	};
}

export function isRetryable(error: PlaidError): boolean {
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
