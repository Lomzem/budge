/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as accounts from "../accounts.js";
import type * as bankConnections from "../bankConnections.js";
import type * as budget from "../budget.js";
import type * as categories from "../categories.js";
import type * as export_ from "../export.js";
import type * as imports from "../imports.js";
import type * as lib_categories from "../lib/categories.js";
import type * as lib_imports from "../lib/imports.js";
import type * as lib_input from "../lib/input.js";
import type * as lib_monthlyTotals from "../lib/monthlyTotals.js";
import type * as lib_owner from "../lib/owner.js";
import type * as lib_payees from "../lib/payees.js";
import type * as lib_plaidClient from "../lib/plaidClient.js";
import type * as lib_publicError from "../lib/publicError.js";
import type * as lib_runEffect from "../lib/runEffect.js";
import type * as lib_search from "../lib/search.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_sync from "../lib/sync.js";
import type * as lib_targets from "../lib/targets.js";
import type * as lib_tokenCipher from "../lib/tokenCipher.js";
import type * as lib_transactions from "../lib/transactions.js";
import type * as migrations from "../migrations.js";
import type * as monthlyTotals from "../monthlyTotals.js";
import type * as owner from "../owner.js";
import type * as payees from "../payees.js";
import type * as reconciliation from "../reconciliation.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as transactions from "../transactions.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  bankConnections: typeof bankConnections;
  budget: typeof budget;
  categories: typeof categories;
  export: typeof export_;
  imports: typeof imports;
  "lib/categories": typeof lib_categories;
  "lib/imports": typeof lib_imports;
  "lib/input": typeof lib_input;
  "lib/monthlyTotals": typeof lib_monthlyTotals;
  "lib/owner": typeof lib_owner;
  "lib/payees": typeof lib_payees;
  "lib/plaidClient": typeof lib_plaidClient;
  "lib/publicError": typeof lib_publicError;
  "lib/runEffect": typeof lib_runEffect;
  "lib/search": typeof lib_search;
  "lib/settings": typeof lib_settings;
  "lib/sync": typeof lib_sync;
  "lib/targets": typeof lib_targets;
  "lib/tokenCipher": typeof lib_tokenCipher;
  "lib/transactions": typeof lib_transactions;
  migrations: typeof migrations;
  monthlyTotals: typeof monthlyTotals;
  owner: typeof owner;
  payees: typeof payees;
  reconciliation: typeof reconciliation;
  seed: typeof seed;
  settings: typeof settings;
  transactions: typeof transactions;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
