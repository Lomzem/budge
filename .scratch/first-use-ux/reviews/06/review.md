# Ticket 06 review

Reviewed `0c7a294...e1e41e3`, checkout at `e1e41e3`, on 2026-11-13. Analysis only; no production changes or commits. Standards and Spec axes were performed inline because the review brief forbids further delegation. This report is the task/handoff record.

## Verdict

No blocking production defect found in ticket 06. One minor verification-documentation finding needs correction. The memory policy is suitable for tickets 07 and 08 without redesign. Browser verification remains blocked by the local backend environment, so this is not a completed UI approval or shipping clearance.

## Standards

**P3 — The maintained rename-memory recipe still assumes automatic Category memory.** `.agents/skills/verify-budge/features/payees.md:33` tells the reviewer to rename an imported Payee, categorize Groceries, Save, then expect both the friendly Payee and Groceries on another import. With a fresh synthetic Payee and the checkbox left unchecked, only the rename is remembered; the next import should be Uncategorized. The ticket correctly changed the API test setup at `convex/payees.test.ts:196` to remember explicitly, but left this manual recipe behind. Fix: require checking “Remember for Sample Verification Shop’s later imports” before Save when expecting Groceries. Preserve the distinct expectation that renaming alone remembers Bank Text identity. **Verified by source tracing; browser reproduction unavailable.** This is a documentation defect, not evidence that production should restore the old behavior.

No other documented-standard breach or actionable smell found. Tool-enforced style/type rules are reported as checks, not duplicate findings.

## Spec

No production finding. Required `SaveOptions.rememberCategory` (`convex/lib/transactions.ts:196`) makes the owner call sites state their policy. Public create/update default to false; categorized choices require `remember: true`; invalid remembering requires a Payee and Category. Rename memory remains separate. Remember does not change approval semantics. Existing stored `lastCategoryId` values remain usable through `lastCategoryOf`, including its existing deleted/Payment Category filtering.

### Category-writer audit

| Writer | Observed policy and evidence |
| --- | --- |
| Manual create/update | `convex/transactions.ts:411,420`: absent flag becomes false, explicit flag reaches the shared owner. |
| Row categorization | `convex/lib/transactions.ts:254`: Category-only `remember` reaches save; `approve: false` preserves review state. Same-value remembering is allowed by table `changeOf`. |
| File imports, new Plaid rows, held-account replay | `convex/lib/imports.ts:146,182` and callers in imports, bankConnections and heldAccounts: resolve existing memory, then insert Unapproved; they never write Category memory. |
| Quiet bank updates | `convex/lib/bankChanges.ts:73`: retain Category or resolve imported Payee memory when Bank Text changes, then replace; no remembering. |
| Take the bank's version | `convex/lib/bankChanges.ts:155`: preserve owner Category/splits, explicitly save with false. Keep mine changes approval only. |
| Unmatch | `convex/imports.ts:127` and `convex/lib/transactions.ts:512`: resolve import memory into a new Unapproved Transaction; no memory write. Matching retains the existing Transaction's Category. |
| Starting Balance/reconciliation | `convex/lib/accounts.ts:31`, `convex/reconciliation.ts:52`: insert/replace bookkeeping Transactions without remembering. Starting Balances have no Payee. |
| Category deletion/reassignment | `convex/lib/transactions.ts:595`: move Transaction/split Categories without teaching the destination as a new remembered choice; deleted memory reads as none. |
| Cutover/Undo | `convex/lib/transactions.ts:769`: restore recorded Transaction/split Categories without rewriting current Payee memory. |
| Seed | `convex/seed.ts:289`: raw fixture writer intentionally supplies pre-existing remembered choices; allowed setup, not a user edit path. `convex/seedBankSync.ts:259` explicitly passes false for simulated owner edits. Raw transfer/split fixture inserts do not teach memory. |

These are source-verified policies, not live Plaid verification. Owner tests independently verify persisted import outcomes.

### Readiness for 07/08

The boolean policy is independent of row selection/grouping. Ticket 07 can apply `categorizeTransaction` with false by default, and use the existing approval owner in the same mutation for categorize-and-approve. Its undo must restore Transaction Category/approval without implicitly teaching memory. If bulk Remember is offered, the UI must identify the affected Payees explicitly; deduplicating writes per Payee is a bulk-operation detail. The shared checkbox accepts caller-owned copy, so it need not change for that. Ticket 08 groups by Payee identity and reuses 07; it needs no new memory model. This is a compatibility assessment, not approval of unimplemented bulk/undo behavior.

## Test audit

Retain the API matrix in `convex/payees.test.ts`: it extends the existing owner fixture, drives actual edits/imports, expects independent Category IDs and Unapproved state, and checks all persisted dates. The two transports exercise distinct public argument mappings. The browser journey owns checkbox wiring, same-Category remembering, reset on reopening, announcement and phone clearance; it does not clone the import matrix. No test-only production seam or internal-call assertion was added. The refusal case checks the public error code. The editor test change only supplies the added fixture field.

I reran the green tests. The implementer's red/probe artifacts are referenced by the ticket but absent from this checkout; I did not independently reproduce those baseline failures or measure a before/after runtime delta.

## /correct — recurring mistake and enforcement

**Class: a Transaction save silently teaches Payee memory.** At the base commit this occurs both for ordinary Category edits (`convex/lib/transactions.ts:280`) and Take the bank's version (`convex/lib/bankChanges.ts:155` calling that owner). The bank resolution never represented a request to remember.

**Recommendation: retain the structural correction already implemented.** The highest useful layer is architecture plus the required options type: one save owner controls teaching, and each caller must state the policy. A new mandatory option would have rejected the base commit's omitted policy at both call sites. The owner sequence catches always-remember and never-remember behavior through actual imported results. Types cannot establish that a person's checkbox consent was transported correctly; that requires the distinct browser proof. No extra lint, new abstraction or repeated instruction is justified by these two occurrences. A required boolean does not by itself detect a caller explicitly choosing the wrong value; the reviewed call-site audit answers that remaining judgment here.

## Recommended answers to open questions

1. **Yes: add “Remembered Category”** through the normal domain-documentation workflow. Suggested definition: “The Category explicitly remembered for a Payee, used to fill later imports and eligible new Transaction drafts. A one-off edit leaves it unchanged; imported Transactions still need review.” Distinguish it from the most recently used Category. Do not rename database fields or APIs merely to add the glossary entry. No glossary edit was made during this analysis-only review.
2. **Acceptable for this ticket, provisionally.** A focusable scrolling list followed by Remember is a reasonable forward Tab order; Shift+Tab can be a shortcut from the search field. It must not be the only reachable path. Source order places Remember after the list; the existing journey proves only the reverse shortcut. Once the environment works, manually check forward Tab through the viewport to Remember and back to search, with visible focus. Do not remove useful keyboard scrolling just to save one Tab stop. No fresh browser usability claim is made here.
3. **Defer a separate explicit Forget action.** Uncategorized/Transfer are Transaction choices and should not silently clear Payee memory. Ticket 06 promises one-off edits and explicit setting, not memory management. A later “Forget remembered Category” should leave historical Categories untouched and make later imports Uncategorized; it deserves its own clear scope and proof. No clearing variant is needed to unblock 07/08.

## Checks and limits

- `bun install --frozen-lockfile`: passed; dependencies were initially absent.
- Focused Vitest: **146 tests in five files passed**, 3.74 seconds (`tests.log`): payees, transactions, imports, bankChanges and transactionEditor.
- `bun run typecheck`: passed, including zero Svelte errors/warnings (`typecheck.log`).
- `bun run check`: codegen freshness, formatting, both ESLint passes, both typechecks and **905 tests across 58 files passed** (test-run duration 26.85 seconds). The command exited 1 only at `capacity:check`, which refused the unavailable local anonymous backend (`check.log`). This is a blocked capacity check, not a passing full check.
- `git diff --check 0c7a294...e1e41e3`: one existing ticket-document extra blank line at EOF, line 102; no production whitespace finding.
- `bun run app up`: failed before readiness: anonymous backend could not fetch its version; output included `Could not find project with name anonymous-agent!` and DNS `EAI_AGAIN` for the telemetry host. `app doctor` confirmed backend/Vite unavailable; credential-presence and generated-code checks passed (`doctor.log`). No credential values were read or included.
- No journeys were run, no screenshots fabricated, and no substitute backend used. `bun run app down` returned “already down.” The three-judge UI gate was not commissioned by this analysis-only sub-agent.

## Principles applied

Test Behavior, Not Implementation directed proof toward real persisted import outcomes and kept browser proof distinct. Prove It Works requires reporting startup failure instead of inheriting the implementer's browser pass. Encode Lessons in Structure and Type System Discipline support the mandatory owner flag over more prose/lint. Laziness Protocol and Foundational Thinking support reusing that policy for 07/08 without a speculative bulk framework. Experience First supports explicit remembering, a distinct future Forget action, and a forward-focus check before judging keyboard usability. Model the Domain keeps Payee memory, Transaction Category, Bank Text rename and approval separate.

Summary: Standards **1 P3** (stale verification recipe); Spec **0 production findings**. Memory policy can unblock 07/08; fresh UI verification remains unavailable.
