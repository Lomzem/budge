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

To repeat one point instead of the full search, use `bun run capacity qfx 254`,
`bun run capacity csv 339`, or `bun run capacity history 9000`. History counts
must be multiples of 60. Each invocation writes a timestamped evidence directory
and a `table.md`; it exits zero when measurement and verification complete even
when the measured scenario exceeds capacity. Read `summary.json` for the decision.
The default search reports commit-only and complete-workflow boundaries separately,
and accepts `history 18000` as a doubling control for the rebuild.
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
