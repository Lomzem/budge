/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as lib_input from "../lib/input.js";
import type * as lib_monthlyTotals from "../lib/monthlyTotals.js";
import type * as lib_owner from "../lib/owner.js";
import type * as lib_publicError from "../lib/publicError.js";
import type * as lib_runEffect from "../lib/runEffect.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_transactions from "../lib/transactions.js";
import type * as monthlyTotals from "../monthlyTotals.js";
import type * as owner from "../owner.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as transactions from "../transactions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  "lib/input": typeof lib_input;
  "lib/monthlyTotals": typeof lib_monthlyTotals;
  "lib/owner": typeof lib_owner;
  "lib/publicError": typeof lib_publicError;
  "lib/runEffect": typeof lib_runEffect;
  "lib/settings": typeof lib_settings;
  "lib/transactions": typeof lib_transactions;
  monthlyTotals: typeof monthlyTotals;
  owner: typeof owner;
  seed: typeof seed;
  settings: typeof settings;
  transactions: typeof transactions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
