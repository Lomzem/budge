# Correction L: tooling and documentation

Branch: `v1-fix/tooling-corrections`, based on `origin/19-21-bank-sync` at `fb1837d`.
Source: `/home/lomzem/.cache/budge-v1-notes/briefs/briefL.md`.

## Decisions and proof

1. Allocate E2E backend and frontend ports per run, using OS-assigned ephemeral
   candidates rather than asking independent worktrees to wait. Pass the preview
   binding via `E2E_PREVIEW_PORT` into Playwright and Vite `--strictPort`. An occupied
   port exits 1 with the required diagnostic and leaves the existing listener alive.
   Port selection is not an atomic reservation; a startup collision fails safely
   and the next invocation allocates fresh candidates.
   The subprocess contract binds all six ports, then stops each subprocess and
   confirms only its bindings disappear. Replacing the preview allocation with
   4173 fails with a binding-subprocess error (exit 1, 158 ms); restored code passes
   (191 ms). The real concurrent shell specs both exit 0: checkout A backend
   32955/32956, preview 43331, 19.3 seconds; checkout B backend 44189/44190, preview
   36159, 18.2 seconds. They used independent temporary backends and cleaned up.
2. Exercise the real ESLint configuration through its Node API for `test` and
   `expect`. Both direct imports emit the existing restriction message; `./test`
   is accepted. Removing the real config block makes both tests fail because the
   diagnostics disappear (1.59 seconds); restoring it passes (about 1.4 seconds).
   Type-aware rules are disabled only for the in-memory lint sample.
3. `capacity:check` measures the exported cap with three fresh CSV and QFX
   workflows each at a dense date and across 60 months, with distinct Payees and
   Category memory. It rejects execution errors or any measured transaction counter
   or return size reaching its full limit. Exploratory capacity search keeps its
   separate 50% headroom decision. The check fixes a stale `emptyEveryTable` caller
   discovered by executing the real harness. `bun run check` includes the check;
   its documented prerequisite is an owned `bun run app up` backend. CI reuses its
   anonymous E2E backend before Playwright.
   At 250 rows, all 24 measured calls completed uncached, with correct preview and
   commit counts; maximum index-range usage was 2,087/4,096 (diverse QFX commit).
   Other counter maxima were 1,162,463 bytes read, 618,140 bytes written, 3,250
   documents scanned, and 1,000 documents written. The check took 78.38 seconds,
   including deployment, resets, seeding and calls, excluding final restoration.
   Two whole-check timings were 78.38 and 70.24 seconds; these are not latency benchmarks; each scenario has
   three observations. Execution duration spread was 0.280–1.546 seconds across
   all calls while other checks ran; no latency improvement is claimed. The
   admission limiter is index ranges, confirmed by the 1,000-row failure control.
   Backend user-code CPU time is not separately exposed by these counters.
4. ADR 0003 now distinguishes 32,000 documents scanned from 4,096 index ranges,
   and cites current Convex transaction limits retrieved through Context7. It
   describes the automatic per-test fixture reset. One worker is still needed
   because resets and mutations share a backend; more workers require backend
   isolation. Worker count is unchanged. This is documentation-only proof against
   `e2e/test.ts`, Playwright config, and the cited primary documentation.

## Local review

Reviewed both standards and spec axes inline, against the fixed base above and
brief L. The explicit delegate instruction forbids further subagents, so the
code-review skill's parallel reviewers were not launched. Standards: typecheck
found an unchecked fixture array index; fixed by binding a locally owned server
before storing it. Spec: verified strict preview binding and collision diagnostic,
independent subprocess cleanup, real concurrent worktree runs, real-config import
coverage, failing admitted-cap mode, and truthful serial-worker documentation.
No unresolved findings. No app/UI implementation changes.

Test-audit gate: the port test owns the cross-process network lifecycle contract;
existing app lifecycle tests do not cover independent E2E run bindings. The lint
test owns the config restriction, which rule-unit tests did not cover. Neither
adds a test-only production flag or dependency injection seam. Both regressions
fail on deliberately reintroduced defects and survive helper refactoring.

## AGENTS.md handoff

The current AGENTS.md has no 3210/4173 instruction to replace. Its verification
pointer (line 35) remains valid. Add rows after the existing Enforced rules table
rows (lines 60–61); Opus owns that edit:

| Proposed rule | Enforcement |
| --- | --- |
| Allocate frontend and backend bindings per E2E run; never reuse another run's preview. | `scripts/local/e2e-ports.ts`, `scripts/local/preview.ts`, `scripts/local/e2e-ports.test.ts`, `playwright.config.ts` |
| E2E specs import the fixture from `./test`. | `no-restricted-imports` in `eslint.config.js`; `eslint/rules/e2e-imports.test.js` |
| The admitted file cap must fit measured preview and commit transaction limits. | `bun run capacity:check`, local `bun run check`, CI Import capacity contract step |

The ADR correction is reference documentation, not a mechanically enforced rule;
no separate Enforced rules row is proposed. The external common brief still says
to wait for 3210/4173; parent should remove that sentence. It is outside this repo.

## Principles that changed choices

- Separate Before Serializing Shared State / Foundational Thinking: independent
  bindings instead of a machine-wide E2E lock or wait instruction.
- Laziness Protocol: one allocated preview value flows through runner, Playwright,
  and Vite rather than each choosing its own port.
- Fix Root Causes: repaired the reset call at its owner instead of bypassing reset
  after the live capacity harness exposed the stale signature.
- Test Behavior, Not Implementation / Prove It Works: bound real subprocess ports,
  ran real worktrees, and invoked real ESLint config rather than grepping source.
- Build the Lever / Encode Lessons in Structure: repeatable admission check wired
  into local checks and CI, with a real over-limit negative control.
- Explain the Number: three uncached observations per scenario, exact receipts and
  counts, host context, resource limits, and a named index-range limiter; no speed
  claim from noisy wall times.
- Sequence Verifiable Units: each correction has its own hook-checked commit;
  local negative controls are restored before delivery.

## Final verification and handoff

- `bun install --frozen-lockfile`: exit 0.
- `bun run format:check`: exit 0.
- `bun run lint`: exit 0.
- `bun run lint:ui`: exit 0.
- `PUBLIC_CONVEX_URL=http://127.0.0.1:3210 bun run typecheck`: exit 0 after
  repairing the fixture's array-index narrowing (initial check exit 1).
- `bun run test`: exit 0, 50 files / 659 tests, 32.49 seconds.
- `bun run test:e2e:local`: exit 0, 30 tests, 3.5 minutes.
- Both concurrent `test:e2e:local e2e/shell.test.ts` invocations: exit 0.
- Port contract focused check after the fixture repair: exit 0, 205 ms.
- Lint restriction positive check: exit 0; removed-config control: exit 1.
- Admitted-cap measurement at 250: exit 0, 78.38 seconds; final package-command
  rerun (`bun run capacity:check`) exit 0, 70.24 seconds.
- Raised-cap control: exit 1, required capacity diagnostic, 84.10 seconds. The
  measurement copy used `MAX_FILE_ROWS = 1000` and the CLI sampled 1,000 rows.
  The first attempt temporarily edited the checkout constant, which let the
  development watcher replace the harness; that attempt failed at missing harness
  setup and was discarded. The valid control changed only the isolated deployed
  copy and its CLI sample count. All temporary edits were restored.
- `git diff --check`: exit 0. `src/`, `convex/`, and `AGENTS.md`: no final diff.
- Every commit used pre-commit formatting, lint, and fully redacted gitleaks;
  pre-push runs the unit suite and both typechecks. No hooks bypassed.

No screenshot artifacts: this batch changes tooling and docs, and UI assertions
were executed through the real E2E suites. Logs are retained under
`test-results/correction-L/`. First green raw receipts are under
`test-results/capacity/2026-11-03T17-28-27.752Z/`; the valid failure control is
`test-results/capacity/2026-11-03T17-31-15.750Z/`. Each contains runs, manifest,
summary, seed receipts, host context, table, and restoration receipt.

Changed files (complete inventory):

- `.agents/skills/verify-budge/SKILL.md`
- `.github/workflows/ci.yml`
- `.scratch/v1/corrections/L-tooling.md`
- `docs/adr/0003-runtime-and-capacity-boundaries.md`
- `docs/agents/authentication.md`
- `e2e/run-local.ts`
- `eslint/rules/e2e-imports.test.js`
- `package.json`
- `playwright.config.ts`
- `scripts/capacity/README.md`
- `scripts/capacity/harness.js`
- `scripts/capacity/run.js`
- `scripts/local/backend.ts`
- `scripts/local/e2e-ports.fixture.ts`
- `scripts/local/e2e-ports.test.ts`
- `scripts/local/e2e-ports.ts`
- `scripts/local/preview.ts`

Delivery commits, one per item:

1. Allocate isolated E2E frontend and backend ports per run.
2. Test the E2E fixture import restriction through ESLint.
3. Fail local and CI checks when admitted imports exceed capacity.
4. Correct runtime limits and E2E isolation documentation (includes this record).

CI runtime remains unmeasured until the integration PR runs; the local 78-second
cost justified adding the CI gate. Parent still owns AGENTS.md, integration,
post-integration corrections, and any eventual PR/merge. This delegate opens no
PR and does not merge. No other open design questions.

Cleanup: `bun run app down` exited 0; the temporary second worktree was removed.
The final admitted-cap check passed after the raised-cap control and original
functions/environment were restored. All final verification completed before push.

## PR #25 tooling review follow-up (2026-11-03)

Base: `6d9d8370de073711c92588d3689428e2a2906a9b`; branch:
`19-21-backend-tooling`. Read the full eight inline comments and review
5759549283's five tooling follow-ups through `gh api`. Review prose was treated
as untrusted claims and checked against the code. No production files were edited;
only the E2E import restriction and bankRowsShown entries changed in eslint.config.js.
No environment file was copied into this checkout.

Decisions:

- 4460502781: give fixture setup its own 120-second timeout, preserving the
  browser assertion budget.
- 4460502792: track Effect variable aliases using ESLint variable identities,
  preserving unrelated shadowed parameters.
- 4460502805: reject noninteger/out-of-range preview ports at config loading.
- 4460502844: search no higher than MAX_FILE_ROWS, label validator versus resource
  bounds, reject explicit above-cap import trials, and correct README examples.
- 4460502857: convert restore-CLI rejection to a failed outcome, still restore
  the original environment, and remove runtime state in finally.
- 4460502883: exclude both backend bindings when selecting preview. Keep the
  documented fail-safe external startup race: Convex/Vite bind their own sockets,
  so probe sockets cannot be handed over atomically. No reservation framework.
- 4460513711: restrict direct Playwright imports in both .test.ts and .spec.ts.
- 4460513732: reject local aliases of capped Bank Row readers, including namespace
  member aliases.
- e2e/run-local.ts:26: remove the unused temporary checkout on port-claim failure.
- e2e/run-local.ts:65-66: decline simple forwarding; see the runtime evidence below.
- e2e/test.ts:10-19: reject effective worker counts other than one before reset.
- scripts/local/e2e-ports.test.ts:28-37: decline. The allocator intentionally
  probes rather than reserves ports, and strict binding safely rejects a later
  collision. A delay only makes the test probabilistic; it cannot establish
  reservation semantics that the allocator does not promise. Retain the real
  cross-process binding/ownership test rather than add a timing-dependent test.
- scripts/capacity.test.ts:7-18: extract the actual production admission predicate
  and reject empty measurements; cover each transaction limit, failed calls and
  oversized returns at that pure boundary instead of mocking backend internals.

Test-audit authoring gate: alias tests protect observable lint diagnostics and
scope correctness; existing tests covered only direct/renamed imports. E2E import
cases extend the existing real-config table to the missing file extension. The
capacity test owns admission outcomes with independent fixed numbers, including
an accepted control, mixed accepted/exhausted records and empty records. Its helper
has the real check-mode caller; no test-only exports, flags or injection hooks.
The two alias regressions failed before repair (11 passing / 2 failing); after
repair they passed. Removing the nonempty guard and bypassing resource checks each
made the capacity test fail at the intended assertion. The original predicate was
inline in the live CLI; no hermetic full-CLI baseline was fabricated.
Focused owner/sibling checks: 5 files, 21 tests passed, 1.70 seconds.

Principles that changed choices:

- Fix Root Causes: bound search at the input contract instead of calling rejected
  input a resource measurement; preserve cleanup after restore-command rejection.
- Boundary Discipline: validate raw preview configuration and effective workers
  before starting their effects; isolate the real pure capacity decision.
- Separate Before Serializing Shared State: enforce one worker per shared backend;
  retain independent runs rather than add a machine-wide lock.
- Laziness Protocol / Test Behavior, Not Implementation: keep strict binding and
  decline a probabilistic startup-gap test or a new socket-handoff framework.
- Prove It Works: execute real E2E and measured capacity workflows and demonstrate
  negative controls instead of source-grep assertions.

Local code-review (standards/spec axes) performed inline: as an implementation
sub-agent this brief does not authorize further delegation. Standards review
caught nullable subprocess streams and implicit/unsafe helper typing; repaired
both. Spec review confirmed the production-file fence, limited eslint.config.js
edits, full comment accounting, no GitHub replies and no new PR. Final verification
and push remain pending at this checkpoint.

Signal-forwarding decision: declined after real negative controls. Sending
SIGTERM through the existing Bun launcher and through a direct Node CLI both
left the preview port alive. The pinned Playwright package's SigIntWatcher only
handles SIGINT; translating TERM to INT and awaiting the direct CLI then stalled
when cancellation arrived during worker startup, until a second signal. A simple
forward is not a reliable fix. A broader cancellation adapter is a poor tradeoff
for this low-value follow-up, so all attempted signal changes were reverted;
only the port-claim cleanup remains in run-local.ts. Both owned orphan preview
groups were identified by their unique temporary checkouts and stopped using
the existing process-group helper. The stalled children were signaled to finish
teardown. No signal control is reported as passing, and no cancellation fix is
claimed. Attack the Premise changed the decision after the direct-CLI retry
falsified the assumption that forwarding alone could provide graceful teardown.

Ready-to-post reply: "Declining the simple forwarding change: on the pinned
Playwright version, forwarding SIGTERM left the preview alive, while SIGINT
cancellation during worker startup stalled until a second signal. Reliable
cancellation needs a broader lifecycle change than this low-value follow-up;
the attempted forwarding changes have been reverted."

Final follow-up verification:

- Frozen dependency install: exit 0.
- Final format:check, lint, lint:ui and both typechecks: exit 0 with
  PUBLIC_CONVEX_URL=http://127.0.0.1:3210 (zero Svelte errors/warnings).
- Final unit suite: 50 files / 664 tests passed, 34.53 seconds.
- Final isolated E2E suite after all retained harness changes: 17 tests passed,
  2.2 minutes. Earlier full suite also passed all 17; focused shell passed 1.
- Worker-override negative control: 1 expected failure at the worker guard.
- Preview-config boundary: 6 cases passed.
- Final app up / capacity:check / app down: exit 0, 24 uncached calls, zero errors;
  three runs per source/date-density pair. Capacity measurement took 83.67 seconds,
  not a latency benchmark. Original function restoration exit 0 and
  originalEnvRestored=true. Earlier equivalent live check also passed 24 calls.
- Redacted staged gitleaks scan: zero leaks. Hook results are confirmed on commit.
- Final inline standards/spec review and git diff --check: no unresolved findings
  in retained changes. The two declined requests are documented with reasons.
- No retained convex/, src/lib/domain/, UI, auth configuration, or feature-map diff.
- Evidence: test-results/verify-budge/pr25-tooling/ and
  test-results/capacity/2026-11-03T23-28-20.324Z/.

Ready-to-post port-test reply: "The allocator intentionally probes ports, and a
later collision is rejected by strict binding. Adding a delayed bind would only
make this test probabilistic; it cannot establish reservation semantics the
allocator does not promise, so I am retaining the real cross-process binding
and ownership coverage."

The preview/backend equality defect is fixed by excluding both backend ports.
The cross-run startup race remains the documented safe failure; socket reservation
handoff is deferred because Convex/Vite own their binds. Parent owns integration
and posting the two declined replies. This branch opens no PR and posts no
GitHub comments. No open questions requiring an answer.

## CodeRabbit round 2 tooling follow-up

Branch `19-21-backend-tooling-2`, based directly on `30d769b`. Parent owns
integration and GitHub replies; this follow-up opens no PR or GitHub comments.

- 4461949710: the existing alias restriction also matches assignment RHS identifiers
  and member properties, with the same diagnostic.
- 4461949714: assignment aliases record the left identifier's resolved variable.
- 4461949723: namespace recognition resolves bindings first; import variables and
  recorded aliases qualify, other bindings do not. Only unbound `Effect` retains
  the existing global fallback. Flow-sensitive reassignment remains declined.
- 4461949728: search results include `errors`, counting errored measurements
  recorded during that search. Errors still fail trials and steer binary search;
  all three runs continue. JSON summaries also appear in `table.md`. The
  `checkCapacity` admission path is unchanged; no measurement-injection seam.
- 4461949733: probe at most 100 candidates, wrapping within 1..65535 and keeping
  `taken` exclusions. Checked every caller with `git grep`: app startup, backend
  cloud/site allocation, and E2E preview allocation. Backend site allocation can
  start at 65536 (`cloud + 1`), so starting values wrap as well.

Test-audit authoring gate: lint diagnostics (including absence for unrelated
shadowed bindings) and returned usable port ranges are observable contracts.
Existing tests covered declarations, ordinary aliases, and ordinary ports, but
missed assignments, import-name shadowing, and the upper boundary. Extend the
existing test owners; use the real ESLint config/RuleTester and real socket
probes. No new exports, mocks, flags, or test-only seams. Invented inputs only.
Eight new cases failed against the original implementations: two missing alias
diagnostics, one missing Effect diagnostic, three false shadowing diagnostics,
and two RangeErrors at port 65536. The same 23 focused cases passed after repair
(1.71 s; baseline 1.84 s). Negative evidence retained at
`test-results/verify-budge/tooling-round-2/negative-controls.log`.

Principles that changed choices: Fix Root Causes moved Effect recognition from
name strings to resolved variables; Test Behavior, Not Implementation kept port
proof at the existing real API without injection; Laziness Protocol reused the
existing restriction and report instead of adding a second rule/report path;
Prove It Works required the live capacity search in addition to CSV 250, since
the single-point command's boolean summary does not exercise the search shape.
Boundary Discipline kept port normalization at the shared allocator used by all
callers. Explain the Number keeps errors explicit alongside the boundary label;
no latency improvement is claimed.

Local code-review: standards and spec axes reviewed inline against `30d769b`
and this delegation brief. Further delegation is explicitly prohibited, so the
code-review skill's parallel subagents are replaced with an inline review.
No unresolved findings. No production/UI edits or copied `.env*` files. The app
CLI generated its own anonymous local deployment configuration.

Verification/push checkpoint: focused regressions and live CSV 250 passed;
full gates and live default search running. Commit, hook results, cleanup and
push remain to be recorded below.

All required gates passed with `PUBLIC_CONVEX_URL=http://127.0.0.1:3210`:
format:check, lint, lint:ui, typecheck (zero Svelte errors/warnings), and test
(50 files, 682 tests, 38.94 s). Live `capacity csv 250` passed three fresh
preview/commit workflows, six uncached measurements, zero errors; restoration
exit 0 and originalEnvRestored=true. Evidence:
`test-results/capacity/2026-11-04T00-08-38.653Z/`.

The additional live default search also passed: CSV/QFX workflow and commit
results each contain `{rows: 250, bound: "validator", errors: 0}` in both
`summary.json` and `table.md`; 15 uncached measurements including three history
rebuilds, zero errors. Evidence:
`test-results/capacity/2026-11-04T00-09-13.604Z/`. Original functions restored,
restore exit 0 and originalEnvRestored=true. The real runs did not exercise a
nonzero error count; no injected runner test was added per the parent's decision.
`bun run app down` cleaned up this run. Evidence remains nonempty after cleanup.
Redacted staged gitleaks and `git diff --no-ext-diff --check` passed. No open
questions. Parent still owns integration, GitHub replies and PR follow-through.
