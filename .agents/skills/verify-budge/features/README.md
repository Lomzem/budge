# Budge verification map

Read this index before driving; use each matching file as the recipe. This is the maintained source for user journeys across the whole app, including specified paths whose UI or preconditions are not yet available. Coverage means mapped, not executed: record the run status separately.

## Baseline preconditions

Follow [Launch and Doctor](../SKILL.md): own this checkout's instance, authenticate with the printed Playwright storage state, seed `budget-with-accounts`, and require the Budget heading plus populated Categories. Use the printed app URL. Seed data is invented and relative to today's date; do not hardcode seed balances or months. `empty-budget` is reserved for first-use checks.

## Driving conventions

Recipes use `page` from an authenticated Playwright context and `expect` from `@playwright/test`. Start each independent mutation recipe from a fresh seed unless stated otherwise; reseeding destroys this instance's previous changes. Use roles, names, labels, and test IDs. Open Account routes through the sidebar's `navigation` named `Budget and Accounts`; at 320 px use `button` named `View …`, then the corresponding `menuitem`. Never share this checkout's seeded data with another driver.

## Proof and skip reporting

Capture action and result screenshots plus `await page.locator('body').ariaSnapshot()`. Save under a unique `test-results/verify-budge/<run>/` directory. Require persistence and side effects through another user-facing view for mutations. Record each sub-feature ID and entry point as passed, failed, or blocked with the exact unmet precondition. Verifying one entry point leaves other entry points unverified. Cleanup runs after failures too and preserves evidence; the skill owns the lifecycle and proof rules.

## Features

| Feature map                         | User-facing coverage                                                     | v1 tickets |
| ----------------------------------- | ------------------------------------------------------------------------ | ---------- |
| [Budget](budget.md)                 | Assigned, Ready to Assign, month navigation, desktop/mobile entry        | 05         |
| [Inspector](inspector.md)           | Inspect, Move to/Take from, Cover, keyboard and phone                    | 07         |
| [Targets](targets.md)               | Monthly, By date, repeat, Assign, Upcoming                               | 08         |
| [Categories](categories.md)         | Groups, create, rename, order, move, hide, delete/history                | 06         |
| [Accounts](accounts.md)             | Cash/Card, starting balances, rename/order, held mapping and suggestions | 03, 21     |
| [Transactions](transactions.md)     | Dialog, CRUD, Direction, Cleared, list pagination                        | 03, 05     |
| [Transfers](transfers.md)           | Linked sides, edit/delete, imported candidate linking, card payments     | 09, 22     |
| [Credit cards](credit-cards.md)     | Payment Category, purchases/refunds, debt, waiting on                    | 10         |
| [Splits](splits.md)                 | Lines, remainder, unsplit, card lines                                    | 11         |
| [Reconciliation](reconciliation.md) | Equal/adjustment, locks, Unlock                                          | 12         |
| [Imports](imports.md)               | Capital One CSV/QFX, Discover CSV, preview, matching, Unmatch, Approve   | 14         |
| [Payees](payees.md)                 | Last Category, exact Bank Text rename memory, API-only global rename     | 15         |
| [Search](search.md)                 | Payee/memo/split/Bank Text, all filters, empty/reset                     | 16         |
| [Bank changes](bank-changes.md)     | Held, quiet changes/removals, accept/keep resolutions (blocked)          | 19, 21     |
| [Plaid](plaid.md)                   | Connect, status, Sync now, reconnect/update, webhook/daily sync          | 17, 18, 20 |
| [Settings](settings.md)             | Cutover first use/change/cancel/constraints                              | 03, 23     |
| [Auth](auth.md)                     | Sign-in/out, owner gate, expired session, GitHub/email                   | 02, 23     |
| [Export](export.md)                 | JSON/CSV completeness and exclusions                                     | 13         |
| [Shell](shell.md)                   | Routes, responsive navigation, theme, Home Screen/device checks          | 02, 04, 23 |

## Route and public API audit

Route consumers: `/sign-in` → Auth; `/` → Budget/Inspector/Targets/Settings/Credit cards; `/categories` → Categories; `/accounts` and `/accounts/[accountId]` → Accounts/Transactions/Search/Imports/Transfers/Splits/Reconciliation/Payees. Shell, Plaid and Export span the authenticated routes.

Public Convex exports were checked against `convex/*.ts` (queries, mutations and actions, excluding internal operations). Map additions must keep this inventory covered:

| Public module     | Exports                                                                                                                                            | Map                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `owner`           | `whoami`                                                                                                                                           | Auth                                                             |
| `settings`        | `get`, `setCutoverDate`                                                                                                                            | Settings                                                         |
| `accounts`        | `list`, `create`, `rename`, `reorder`                                                                                                              | Accounts                                                         |
| `budget`          | `month`, `setAssigned`, `moveMoney`, `cover`, `assignTarget`                                                                                       | Budget, Inspector, Targets, Credit cards                         |
| `categories`      | `list`, `createGroup`, `create`, `rename`, `setTarget`, `renameGroup`, `move`, `moveGroup`, `setHidden`, `setGroupHidden`, `remove`, `removeGroup` | Categories, Targets                                              |
| `transactions`    | `list`, `create`, `update`, `transferCandidates`, `remove`, `setCleared`, `unlock`, `approve`, `approveAll`, `unapprovedCount`                     | Transactions, Transfers, Splits, Reconciliation, Imports, Search |
| `imports`         | `preview`, `commit`, `unmatch`                                                                                                                     | Imports                                                          |
| `payees`          | `list`, `lastCategory`, `rename`                                                                                                                   | Payees (global rename has no UI), Search                         |
| `reconciliation`  | `clearedBalance`, `reconcile`                                                                                                                      | Reconciliation                                                   |
| `bankConnections` | `list`, `syncNow`                                                                                                                                  | Plaid                                                            |
| `export`          | `tables`, `page`                                                                                                                                   | Export                                                           |

Tickets 01 (scaffold) and 04 (hosting/preview setup) supply operational prerequisites rather than additional app controls. Ticket 23's production credentials, real-bank setup, usage measurements and real-iPhone checks require owner/external access and remain outside a local seeded proof. Their user journeys are mapped under Accounts, Settings, Plaid, Auth and Shell. Internal seed/migrations/cache rebuild and provisioning are setup, not alternate user entry points.
