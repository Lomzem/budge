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
