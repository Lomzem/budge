# Capacity check

## Decision recorded before measurement

Keep the atomic 1,000-row import only if all measured read/write/count/byte resources stay strictly
below 50% of their limits in three fresh runs of each file path. Otherwise find
the largest integer row count satisfying that rule, without batching the import.
Rebuild five years at 150 Transactions/month (9,000 total), with 10% two-line
splits. This is an assumption: the spec, glossary and ADRs give no monthly volume.
If it fails the same headroom rule, locate the crossing volume for later resumable
rebuild work. Use the maximum resource consumption across runs; report duration
min/max separately. Stop drawing duration conclusions when spread exceeds the
effect. Counts should be deterministic; any count spread requires investigation.

Current limits, checked 2026-11-02 against
[Convex limits](https://docs.convex.dev/production/state/limits#transactions):
16 MiB read, 16 MiB written, 32,000 documents scanned, 16,000 documents written,
4,096 index ranges read, and 1 second user-code execution (database waits excluded).
ADR 0003's 4,096-document wording conflates documents with index ranges.

## Run

`bun run app up`, then `bun run capacity`, then `bun run app down`.
This **resets all data on this checkout's anonymous local backend**. Never use it
on a budget you want to retain. Deployment validation precedes reset or deployment.
It refuses cloud deployments and deployment-selection overrides.

The script temporarily deploys an extra measurement module alongside byte-for-byte
copies of the existing functions. The original source files stay untouched.
The module calls the real `imports.preview`, `imports.commit`, and
`monthlyTotals.rebuild` entry points, reading transaction metrics from the backend.
An admin acting-as identity uses the local backend's configured test owner, without
minting Clerk sessions. Finally the original modules are redeployed.

Each import uses distinct 500-character Bank Texts, distinct Payees, aliases with
Category memory, distinct QFX IDs (CSV forbids IDs), and 1,000 same-amount nearby
Transactions. Explicit `pick: new` forces writes while retaining candidate scans.
The density is a scenario bound, not a universal worst case: the date window can
contain arbitrarily many Transactions. A row cap alone cannot guarantee headroom.

Raw metrics, outcomes, seed receipts and function completion logs are saved under
`test-results/capacity/` (gitignored). Fresh resets prevent prior imports or query
cache hits from making repeated runs cheaper. The live script checks added/matched/
skipped counts, uncached execution receipts, and rebuilt totals against independent
fixture expectations. Failed transactions are reported as failures, never as cheap
successful imports.

Metrics sources: [local deployments](https://docs.convex.dev/cli/local-deployments),
[transaction metrics](https://docs.convex.dev/database/writing-data#limits), and the
pinned Convex CLI's `generatedFunctionLogsApi.ts`. The backend's
[`stream_udf_execution`](https://github.com/get-convex/convex-backend/blob/main/crates/local_backend/src/logs.rs)
endpoint supplies uncached completion receipts, durations and usage; `ctx.meta`
supplies index-range consumption missing from that endpoint.

To repeat one point instead of the full search, use `bun run capacity qfx 250`,
`bun run capacity csv 250`, or `bun run capacity history 9000`. History counts
must be multiples of 60. Each invocation writes a timestamped evidence directory
and a `table.md`; it exits zero when measurement and verification complete even
when the measured scenario exceeds capacity. Read `summary.json` for the decision.
The default search stays within `MAX_FILE_ROWS` and reports commit-only and
complete-workflow boundaries separately. A passing ceiling is labeled `validator`;
a lower boundary is labeled `resource-headroom`. Each search result contains
`rows`, `bound`, and `errors` (the number of errored measurements the search
judged, including measurements the commit search reuses from the workflow search), in both `summary.json` and the summary section of `table.md`.
Errors count as failed trials and lower the search ceiling; the search continues
so a timeout above the boundary can still locate a passing row count. A
`resource-headroom` label with nonzero `errors` includes execution failures, not
only completed measurements exceeding the headroom threshold. Use `history 18000` as a doubling
control for the rebuild.
Resource decisions use transaction counters, not billed I/O statistics. Durations
are observations, not a claim about production latency or CPU headroom.

The counters do not show the 1 s user-code budget. To time the matcher alone,
run `bun scripts/capacity/matcher.ts`: it matches 13 to 1,000 rows against 1,000
same-date candidates, three runs each, without a backend.

Do not run two capacity commands concurrently in one checkout: they share the
same deployment and reset its tables. Use a separate checkout and `app up` for
independent measurements. After an interrupted run, repeat the command to reseed
and reconcile the temporary deployment; normal completion restores source modules
and the checkout's original `.env.local`.

## Failing contract check

Run `bun run app up`, then `bun run capacity:check` (or `bun run check` for all
local gates), then `bun run app down`. The check resets this checkout's anonymous
backend. It measures the exported `MAX_FILE_ROWS` in preview and commit for CSV
and QFX: three fresh runs each, at one dense date and across 60 months, with
distinct Payees and Category memory. All five transaction counters and the return
size must stay below the full limits; errors also fail. The exploratory command's
50% headroom search remains separate from this admission contract.

An over-capacity check exits 1 with
`Import capacity contract failed; reduce MAX_FILE_ROWS or reduce measured preview/commit work.`
Setup, skipped-work, and restoration failures also exit nonzero. Evidence includes
uncached completion receipts, counts, metrics, host load, and a timed summary.
The first complete 250-row check took 78.38 seconds locally (12 workflows, 24
measured calls, including temporary deployment and seed work, excluding final
restoration). This fits the roughly three-minute budget, so CI runs it against its
existing anonymous E2E backend before Playwright. CI runtime remains to be measured.
`capacity:check` requires that backend; it never silently skips missing setup.

## Later cutover contract

A confirmed later cutover date is applied in one atomic mutation, so its reads are
bounded by `LATER_CUTOVER_READS` (`convex/lib/laterCutover.ts`) and a bigger
history is refused before preview. `bun run capacity cutover` seeds two worst-case
shapes from those bounds: 200 reconciled Starting Balances plus the remaining
Transactions with every bank row, and 10 Accounts with Transfer pairs and every
split line and bank row, each with 500 earlier Assigned amounts and 9,900 monthly
totals. It previews, applies and undoes each shape three times, checks the applied
and undone counts against the seed, and saves the metrics. `capacity:check` runs
each shape once (the counts are deterministic) and exits 1 with
`Later cutover capacity contract failed; reduce LATER_CUTOVER_READS or reduce measured preview/apply/undo work.`
when any call reaches a full limit.

Measured 2026-11-13 at 250 Transactions, 250 bank rows and 250 split lines: the
apply's largest use was 2,641 of 4,096 index ranges (64%) and 15,775 of 32,000
documents read (49%), and the undo's was 2,335 index ranges (57%); every delete
and patch counts as an index range. At 500
Transactions the apply exceeded 4,096 index ranges, which set the lower bounds.

## Bulk categorize contract

Categorizing selected Transactions (and approving them too) runs in one atomic
mutation, and so does its undo, so both refuse more than `BULK_CATEGORIZE_LIMIT`
(`src/lib/domain/bulkCategorize.ts`) Transactions. `bun run capacity bulk COUNT`
seeds COUNT Unapproved Transactions across 60 months, each with a distinct
500-character Payee, Payee alias, 500-character memo and linked bank row, then
categorizes and approves all of them and undoes it, three times. It checks the
moved Category, the approvals and the monthly totals after each step against the
seed. `capacity:check` runs `BULK_CATEGORIZE_LIMIT` once and exits 1 with
`Bulk categorize capacity contract failed; reduce BULK_CATEGORIZE_LIMIT or reduce measured categorize/undo work.`
when any call reaches a full limit.

Measured 2026-11-13: each Transaction costs about 5 index ranges, 16 documents
read and 5 written, and the undo reads about 1.3 times the bytes. At 250 the
largest use was 1,456 of 4,096 index ranges (36%) and 3,880 of 32,000 documents
read, in 0.46 seconds. At 500 the index ranges reached 66% and each call took
0.9 to 1 second, which set the limit at 250.
