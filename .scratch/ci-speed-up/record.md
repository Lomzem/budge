# CI speed-up

Status: resolved

Change: d1ab150 on `main`. Measure any run with `.scratch/ci-speed-up/timing.sh <run-id> <attempt>`.

## Result

| | Runs | Wall clock median | Range |
|---|---:|---:|---:|
| Before (`e2e` one job) | 14 first-attempt successes, Nov 14–17 | 609 s | 497–671 s |
| After (run 44188445437, attempts 1–3) | 3 | 188 s | 170–197 s |

Before, `e2e` set the wall clock in all 15 sampled runs: capacity (107 s median) then 64 serial journeys (468 s). After, the slowest browser shard sets it (shard 2/4: 141–162 s Playwright), with `checks` close behind (135–167 s; ESLint 59–73 s, Vitest 43–56 s). Shards split by test count, not time, so shard 2 carries slower journeys. Each shard pays about 35 s of fixed setup (install, headless shell 12–33 s, backend 6–9 s) plus a ~10 s app build.

## Decisions

- Shard journeys 4 ways by test (`fullyParallel`, one worker per shard, own backend each). Each shard lists its tests first, because Playwright passes an empty shard.
- Capacity runs as its own matrix entry. Playwright global setup now runs the dev-only Clerk credential check that capacity used to provide before Playwright in the same job.
- `--only-shell` Chromium install: 24 s median before, 12–33 s after.
- Cancel superseded runs on PRs only; each main push keeps its event-scoped secret scan.
- Step timeouts (capacity 10 min, Playwright 15 min) under a 30 min job timeout, so failure uploads still run.
- Failure artifact: `convex.log` and the capacity `table.md`. The old `playwright-report/` path was never written. The repo is public, so traces, screenshots, and raw capacity records stay out.

## Rejected

- Bun package cache: install takes 2–4 s.
- Playwright browser cache: Playwright advises against it; the shell download is a few seconds of the install.
- Convex backend binary cache: backend start is 6–9 s and the backend version moves independently of `bun.lock`.
- Path filters for docs-only changes: they push straight to main without blocking anyone, and a filter could skip feature-map Markdown that Vitest reads.
- ESLint/Prettier caches: typed lint has cross-file dependencies the cache doesn't track.
- Merging `lint:ui` into `lint`: saves ~3 s and changes the hooks too.
- Changed-test selection: Vitest and Playwright both say to run the full suite before merging.
- Playwright retries: they would hide the flaky journeys below instead of fixing them.

## Remaining

- Flaky journeys seen in the baseline window: `categories/reorder`, `categories/late-rename`, `plaid/superseded-sync`, `budget/month-jump`, and one Convex startup `Error fetching POST`. A flake now costs a ~3 min shard rerun instead of a 10 min job.
- Next wall-clock limiter: shard balance and `checks` (ESLint). Options: a fifth shard, or splitting `checks` into lint and test jobs.
