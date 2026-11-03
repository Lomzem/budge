# Capacity measurement E

Branch: `v1-fix/capacity-check`. Measured production source:
`fdfb099adcbef6674115c0538a4d55bc28a88014` (`origin/19-21-bank-sync` at checkout).
The handoff reports the final tooling commit SHA. No production files changed.

## Decision and recommendation

The [decision rule](README.md#decision-recorded-before-measurement) was recorded
before the first scenario. All decisions require three completed fresh runs and
strictly less than half of each read/write/count/byte limit. Return bytes are also
checked; durations are observations, not a CPU-headroom claim.

**Do not retain 1,000.** All three 1,000-row previews and commits failed for each
format, with timeouts and/or memory exhaustion. Failed work is never counted as a
cheap success. Final transaction counters are unavailable on these failures;
partial execution usage and error messages are retained in raw receipts.

**Commit-only shared cap: 254 rows in this fixture.** QFX 254 used 2,044 index
ranges in all three runs; QFX 255 used 2,048 in all three runs, exactly half of
4,096 and therefore rejected by the strict rule. CSV 254 also passed three times,
using 1,791 index ranges. The limiter for this shared atomic commit cap is **index
ranges read**, mapped to source-ID lookups, candidate Bank Row lookups, distinct
Payee/alias/category lookups, totals maintenance and search-text reads in
`convex/lib/imports.ts`, `convex/lib/payees.ts`, and `convex/lib/transactions.ts`.
Doubling 254 already exceeds the headroom rule; the measured adjacent boundary is
a stronger discriminator than a throughput extrapolation. CSV 339 timed out 3/3;
CSV 340 completed once at 2,049 ranges, so 339 is not a verified safe CSV cap.

**Complete workflow: 13 rows under the specified dense-candidate bound.** Both
formats completed preview and commit three times at 13 rows in the final runs.
Preview read 8,293,211 bytes (49.43% of 16 MiB) and 14,002 documents; 14 rows read
8,912,211 bytes (53.12%). The limiter is **preview read bytes** from repeatedly
hydrating up to 1,000 matching candidate Payees for every file row
(`convex/imports.ts`, `describeCandidate` and `describeAll`). Thirteen is not a
universal safe cap: the existing API places no bound on nearby history or on the
candidate fan-out. The parent should resolve that independent capacity problem
before treating a commit cap as an end-to-end safety guarantee. Imports remain
atomic throughout; no batching implementation was added.

**Five-year rebuild: keep the current approach at the assumed volume.** Three
9,000-Transaction rebuilds used 10,920 document reads, 120 write operations,
2,583,780 bytes read, 11,640 bytes written and 975 index ranges. Doubling to 18,000
completed three times at 21,720 document reads (67.88% of the 32,000 hard limit),
120 writes, 5,144,280 read bytes, 11,640 write bytes and 1,875 index ranges. The
limiting headroom metric is **documents scanned** by the full-history traversal in
`convex/lib/monthlyTotals.ts:rebuildMonthlyTotals`. Nine thousand is below 50%;
18,000 is above. A precise crossing search is not required by the decision rule
when the five-year case passes, and was not claimed.

## Evidence and bounds

The spec, glossary and relevant ADRs gave no Transactions/month count, so the
history assumes 150/month for 60 months and 10% split parents with two lines.
The fixture has one Account and one Category, producing 60 totals. More Account/
Category combinations increase cache rows and rebuild writes; this result does
not establish a bound for arbitrary cache cardinality. Each import fixture has
1,000 nearby uncleared Transactions of the same amount, 1,000 distinct 500-character
Payees and aliases with Category memory, and distinct 500-character Bank Texts.
QFX IDs are distinct; CSV omits IDs because its public validator forbids them.
Explicit `pick: new` retains candidate work while forcing new Transactions.

Each repetition resets the local database. Seed return counts are checked; newer
runs retain seed receipts as JSONL. Successful commits must report exactly
`added = rows`, `matched = skipped = 0`. Preview must describe every row as new.
Rebuild is primed outside measurement so the measured operation replaces existing
cache rows. Its read-back must have 60 rows, total cents `-100 * Transactions`,
and a total line count equal to 110% of the Transaction count. At 9,000 this is
-900,000 cents and 9,900 counted lines. All measured completion receipts are
uncached. Resource-count spreads for completed identical scenarios are zero.

Initial adjacent QFX sizes had intermittent timeouts while host load was elevated
(a sampled load average was 22.34 on 12 logical CPUs). Later final 13/14-row runs
completed 3/3; all initial failures remain in the table. Durations vary materially
and support no latency improvement claim. Backend logs expose wall duration and
outer user execution time; the latter does not establish nested-call CPU headroom.
The harness adds a nested-function envelope and metrics return, so wall durations
include that envelope. It calls the real public import and internal rebuild entry
points in the same transaction, with original production modules copied unchanged.

The first 18,000-row fixture load hit the backend's 4 MiB/s write-throughput limit
before measurement. Pacing seed batches by 250 ms removed that load-generator
failure; the paced scenario completed three times. Failed-load exit code: 1;
paced rerun: 0. This throughput error is not the rebuild's per-transaction limiter.

The first restore command removed the anonymous deployment selector from
`.env.local`; subsequent attempts correctly refused to run (exit 1). The script
now snapshots/restores the original file. Consecutive measured reruns succeeded,
and final-code runs save a read-back restore receipt. No credentials are written
to evidence. Source modules are redeployed on normal completion.

Current limits were checked against the [Convex docs](https://docs.convex.dev/production/state/limits#transactions).
Their 4,096 budget is index ranges, not documents; ADR 0003's document wording
should be corrected by the parent. `ctx.meta.getTransactionMetrics()` supplies
transaction consumption. Execution-log usage includes billing and serialization
accounting and can differ from transaction counters; they are not substituted.
Raw completion logs are obtained from the local backend's
[`stream_udf_execution`](https://github.com/get-convex/convex-backend/blob/main/crates/local_backend/src/logs.rs)
endpoint, following the pinned CLI's generated protocol. All calls target this
checkout's anonymous backend, not cloud Convex.

## Run and artifacts

See [README.md](README.md) for commands. `bun run capacity` runs the full search;
`bun run capacity qfx 254` or `bun run capacity history 9000` repeats one point.
A successful measurement command exits zero even when a scenario exceeds capacity;
`summary.json` records whether the point satisfied the rule. Raw output lives in
`test-results/capacity/`, ignored by Git. The initial full measurement exited 0;
all completed targeted measurement commands exited 0. The two setup failures
above exited 1 and were corrected before the final successful runs.

## Verification and review

The CLI's cloud-refusal contract failed before implementation (exit 1, missing CLI
module instead of refusal), then passed (exit 0). This is red/green evidence for
new tooling, not a claimed production regression repair. The test drives the CLI
from an isolated invented cloud checkout; it protects refusal before any reset or
deployment and does not mock private collaborators. Existing tests lacked a
capacity command. No test-only production seams were added.

Required-check exit codes: `format:check`: 0, `lint`: 0, `lint:ui`: 0, `typecheck`: 0, `test`: 0, `test:e2e:local`: 0.
Unit tests: 589 passed; local E2E: 17 passed. Focused lint: 0.
Local review used the code-review skill's Standards and Spec axes inline because
the brief explicitly forbids subagents. Standards: fixed unsafe throw from finally;
Spec: separated commit/workflow decisions, paced seeding, preserved deployment
configuration, and documented density/cardinality/noise limits. No unresolved
in-scope findings. No UI changes or screenshots; no PR was opened.

## Principles that changed choices

- **Explain the Number:** recorded the decision before measuring, separated range
  counts from document counts, kept failures and run spreads, and measured a
  doubling control instead of extrapolating rebuild throughput.
- **Build the Lever / Prove It Works:** committed executable generation,
  measurement, assertions and table rendering, using real functions and uncached
  receipts rather than in-memory estimates.
- **Foundational Thinking / Separate Before Serializing Shared State:** kept the
  unchanged production modules separate from temporary instrumentation and used
  this worktree's own anonymous backend and evidence directory. Concurrent runs
  within this checkout remain unsupported and are documented.
- **Fix Root Causes / Make Operations Idempotent:** repaired deployment-selector
  restoration after an actual failed rerun; every scenario reseeds from empty
  state, so a prior import cannot turn later work into skips.
- **Test Behavior, Not Implementation / Sequence Verifiable Units:** proved the
  refusal at the CLI boundary red then green, then exercised real scenarios;
  retained no source-grep or helper-call assertions.
- **Laziness Protocol / Guard the Context Window:** reused local deployment,
  credential and reset helpers, and retained full raw receipts on disk while
  summarizing their counters for review.

Deliberately left out: production cap changes, candidate-scan changes, category
reassignment benchmarking, resumable rebuild implementation, and universal
capacity claims. These belong to the parent's production decisions or exceed the
brief. Open questions: how should preview fan-out be bounded, what history density
should a production promise admit, and what Account/Category cardinality should a
follow-up rebuild fixture cover?

## All measured points

Counts/bytes use transaction metrics from completed calls. Failed calls have no final transaction metrics; their partial execution usage is retained in runs.json. Duration is total backend wall time in seconds, including database waits. Ranges show min–max, with identical endpoints collapsed.

| Scenario |  Rows | Function | Success/runs |   Docs read | Docs written |  Bytes read | Bytes written | Index ranges | Duration (s), all runs |
| -------- | ----: | -------- | -----------: | ----------: | -----------: | ----------: | ------------: | -----------: | ---------------------: |
| qfx      |  1000 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.556–1.808 |
| qfx      |  1000 | commit   |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.622–1.859 |
| qfx      |   500 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.387–1.722 |
| qfx      |   500 | commit   |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.367–1.469 |
| qfx      |   250 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.454–1.540 |
| qfx      |   250 | commit   |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.394–1.486 |
| qfx      |   125 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.135–1.384 |
| qfx      |   125 | commit   |          2/3 |        2125 |          500 |      704088 |        309015 |         1528 |            1.038–1.628 |
| qfx      |    62 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.417–1.584 |
| qfx      |    62 | commit   |          3/3 |        1558 |          248 |      473105 |        153254 |         1276 |            0.936–1.205 |
| qfx      |    31 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.682–2.450 |
| qfx      |    31 | commit   |          3/3 |        1279 |          124 |      359459 |         76622 |         1152 |            1.107–1.918 |
| qfx      |    15 | preview  |          2/3 |       16002 |            0 |     9531211 |             0 |         2041 |            2.318–2.637 |
| qfx      |    15 | commit   |          3/3 |        1135 |           60 |      300803 |         37070 |         1088 |            0.864–1.178 |
| qfx      |     7 | preview  |          3/3 |        8002 |            0 |     4579211 |             0 |         2033 |            1.622–1.960 |
| qfx      |     7 | commit   |          3/3 |        1063 |           28 |      271478 |         17297 |         1056 |            0.517–0.880 |
| qfx      |    11 | preview  |          2/3 |       12002 |            0 |     7055211 |             0 |         2037 |            2.008–2.653 |
| qfx      |    11 | commit   |          3/3 |        1099 |           44 |      286139 |         27182 |         1072 |            0.680–1.081 |
| qfx      |     9 | preview  |          2/3 |       10002 |            0 |     5817211 |             0 |         2035 |            1.663–2.568 |
| qfx      |     9 | commit   |          3/3 |        1081 |           36 |      278808 |         22239 |         1064 |            0.630–1.556 |
| qfx      |     8 | preview  |          3/3 |        9002 |            0 |     5198211 |             0 |         2034 |            1.381–1.508 |
| qfx      |     8 | commit   |          3/3 |        1072 |           32 |      275143 |         19768 |         1060 |            0.529–0.714 |
| csv      |  1000 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.262–1.493 |
| csv      |  1000 | commit   |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.272–1.415 |
| csv      |   500 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.283–1.299 |
| csv      |   500 | commit   |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.262–1.335 |
| csv      |   250 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.292–1.306 |
| csv      |   250 | commit   |          1/3 |        3250 |         1000 |     1156823 |        612500 |         1779 |            1.571–1.694 |
| csv      |   125 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.202–1.423 |
| csv      |   125 | commit   |          3/3 |        2125 |          500 |      701323 |        306250 |         1404 |            1.024–1.138 |
| csv      |    62 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            0.946–1.192 |
| csv      |    62 | commit   |          3/3 |        1558 |          248 |      471751 |        151900 |         1215 |            0.668–1.023 |
| csv      |    31 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.367–1.494 |
| csv      |    31 | commit   |          3/3 |        1279 |          124 |      358787 |         75950 |         1122 |            0.464–0.589 |
| csv      |    15 | preview  |          3/3 |       16002 |            0 |     9531211 |             0 |         2027 |            1.044–1.234 |
| csv      |    15 | commit   |          3/3 |        1135 |           60 |      300483 |         36750 |         1074 |            0.412–0.504 |
| csv      |     7 | preview  |          3/3 |        8002 |            0 |     4579211 |             0 |         2027 |            0.669–0.745 |
| csv      |     7 | commit   |          3/3 |        1063 |           28 |      271331 |         17150 |         1050 |            0.309–0.335 |
| csv      |    11 | preview  |          3/3 |       12002 |            0 |     7055211 |             0 |         2027 |            0.861–0.929 |
| csv      |    11 | commit   |          3/3 |        1099 |           44 |      285907 |         26950 |         1062 |            0.338–0.368 |
| csv      |    13 | preview  |          3/3 |       14002 |            0 |     8293211 |             0 |         2027 |            0.914–0.971 |
| csv      |    13 | commit   |          3/3 |        1117 |           52 |      293195 |         31850 |         1068 |            0.348–0.352 |
| csv      |    14 | preview  |          3/3 |       15002 |            0 |     8912211 |             0 |         2027 |            1.001–1.194 |
| csv      |    14 | commit   |          3/3 |        1126 |           56 |      296839 |         34300 |         1071 |            0.368–0.430 |
| history  |  9000 | rebuild  |          3/3 |       10920 |          120 |     2583780 |         11640 |          975 |            3.267–3.717 |
| csv      |   339 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.212–1.241 |
| csv      |   339 | commit   |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.304–1.458 |
| csv      |   254 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.001–1.077 |
| csv      |   254 | commit   |          3/3 |        3286 |         1016 |     1171399 |        622300 |         1791 |            0.995–1.184 |
| qfx      |   254 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.329–1.433 |
| qfx      |   254 | commit   |          3/3 |        3286 |         1016 |     1177131 |        628032 |         2044 |            1.373–1.423 |
| history  | 18000 | rebuild  |          3/3 |       21720 |          120 |     5144280 |         11640 |         1875 |          10.448–10.533 |
| qfx      |    13 | preview  |          3/3 |       14002 |            0 |     8293211 |             0 |         2039 |            0.718–0.773 |
| qfx      |    13 | commit   |          3/3 |        1117 |           52 |      293471 |         32126 |         1080 |            0.272–0.293 |
| qfx      |    14 | preview  |          3/3 |       15002 |            0 |     8912211 |             0 |         2040 |            0.773–0.822 |
| qfx      |    14 | commit   |          3/3 |        1126 |           56 |      297137 |         34598 |         1084 |            0.246–0.269 |
| qfx      |   255 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.349–1.470 |
| qfx      |   255 | commit   |          3/3 |        3295 |         1020 |     1180798 |        630505 |         2048 |            1.297–1.367 |
| csv      |   340 | preview  |          0/3 | unavailable |  unavailable | unavailable |   unavailable |  unavailable |            1.212–1.243 |
| csv      |   340 | commit   |          1/3 |        4060 |         1360 |     1484783 |        833000 |         2049 |            1.265–1.461 |
