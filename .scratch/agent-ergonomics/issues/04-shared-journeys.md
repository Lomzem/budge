# 04: One journey module for E2E and verify-budge

**Status:** ready-for-agent

**Spec:** [Agent ergonomics](../spec.md), scope 4

**Blocked by:** 01, 03 (they change dialog E2E)

## Problem

E2E seeds a fixture per test (`e2e/test.ts`, `loadFixture`). verify-budge (`.agents/skills/verify-budge/`) has 19 prose feature recipes and one runnable helper, `features/prove-budget.sh`. Every other proof is a hand-written Playwright session, with evidence capture retyped each time. `features/README.md` has a hand-synced public Convex export table that drifts.

## What to build

- A journey module (e.g. `e2e/journeys/`) of user journeys that take a Playwright `Page` and a small context, and drive and assert through the UI.
- Two adapters over it:
  - the E2E specs, which keep their per-test fixtures;
  - a verify-budge runner script, which runs named journeys against the running `bun run app` instance with its storage state, captures screenshots and a trace per step into `test-results/verify-budge/<run>/`, and exits non-zero on failure.
- Migrate the E2E specs where a journey fits. Don't force every assertion into a journey.
- Point the feature map files at their journeys instead of restating selectors. Replace or delete `prove-budget.sh` if a journey covers it.
- Replace the hand-synced public-function table with a generated or checked one, or delete it if nothing needs it.
- Keep the `e2e/test.ts` fixture rule (eslint `no-restricted-imports`) and the port ownership rule intact.

## Acceptance

- [ ] `bun run test:e2e:local` passes.
- [ ] One documented command runs a journey against a running app, writes evidence that survives `bun run app down`, and fails on a broken assertion (shown by a planted failure).
- [ ] verify-budge SKILL.md and features/README.md document the runner; every feature file still answers the four questions.

## Comments
