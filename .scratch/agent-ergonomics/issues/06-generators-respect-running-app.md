# 06: Generating commands don't reload a running journey's page

**Status:** needs-triage

**Spec:** [Agent ergonomics](../spec.md). This is a follow-up from first-use-ux ticket 11, deferred `/correct` suggestion 3.

**Blocked by:** None

## Problem

`bun run sync` (`svelte-kit sync`) and `bun run codegen` rewrite generated files even when their content hasn't changed. `bun run check`, `typecheck`, `prepare` and the pre-push hook all run one of them. If one of these runs in a checkout while `bun run app verify` or a manual Playwright session drives that checkout's app, Vite reloads the page. The reload drops in-page state such as a selection or a dialog draft, so the journey fails for a reason unrelated to the change under test.

Today the only guard is a sentence in `.agents/skills/verify-budge/SKILL.md` step 2. During first-use-ux, agents broke the rule several times while running checks in parallel with a journey, and each time had to diagnose a flaky failure.

## What to build

Pick one, after measuring which generated files are touched:

- Make the generators write a file only when its content differs, so a no-op run leaves the tree alone and Vite doesn't reload. Then show that `sync` and `codegen` on an unchanged tree don't reload a driven page.
- Or have the generating commands take the per-checkout app lock in `scripts/app/lock.ts` while a journey or a manual drive holds it, failing fast with a message that names the running app.

A change that really does alter generated files may still reload the page. The goal is that a no-op check is safe during a journey.

## Acceptance

- Running `bun run check` in a checkout while `bun run app verify <a journey that holds a selection>` drives it either leaves that journey passing or refuses with a clear message. It never makes the journey fail intermittently.
- A test pins the chosen behavior, for example in `scripts/app/lifecycle.test.ts` or a generator test.
- The verify-budge skill's step 2 warning is updated to match.
- If it becomes a rule, it gets an AGENTS.md "Enforced rules" row.

## Comments
