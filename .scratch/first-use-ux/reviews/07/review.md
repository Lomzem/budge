# Ticket 07 review

Revision: `58786ce0d4610b948a5c63426005a2e890613387`; range `e274bca...58786ce`. Analysis only; no commits or application changes. Reviewed the complete reviewer brief, ticket and Comments, first-use spec, ticket 08, repository instructions, glossary, ADR 0002, Convex guidelines, and the relevant principles. Applied code-review's two axes inline: this review brief explicitly prohibits further delegation.

## Verdict

Request changes before calling 07 complete. The selection and bulk-write foundations can support ticket 08 without replacement, but fix completion ownership and settle the Undo conflicts below first. Group selection can use `SelectionPerScope.set(ids, picked)` and reuse the same atomic mutations. Grouping must use existing Payee IDs and clearly scope group selection to displayed/loaded Transactions; avoid silently selecting an entire unseen history or auto-chunking a group above 250.

## Standards axis

No additional unhandled documented-standard breach found in the reviewed diff. Writes remain in `convex/lib/transactions.ts` and its monthly-totals owner; both public mutations require the owner. Category/approval state uses the established writers, not raw patches in the endpoint. The general opt-in is a small justified extension of the existing picker, and the selection helper has production callers rather than being a test-only export. No speculative group framework is needed for 08.

Test-audit: the three new owner tests protect persisted selection scope, deliberate memory, independent approval and Undo, and refusal without partial writes. Browser tests add distinct selection/picker/focus/phone transport coverage and extend existing approval proof. Retain them. Gaps are delayed bulk completion, deleted previous Categories, and intervening edits that return to the same value. The existing seeded cache sequences do not themselves exercise the two new endpoints; a review probe compared rebuilds directly after both operations on Cash and Credit Card Accounts and passed. Extend that existing invariant owner if durable coverage is wanted rather than adding another totals implementation.

## Spec axis — findings by severity

### P2: A completed old bulk request clears a newer selection (verified)

`src/lib/components/transactions/transaction-table.svelte:600`; sibling completion at `:564`.

Reproduction: select the bookshop, submit a bulk Category and hold its response; press Clear and check a Coffee Shop row; release the response. The new checkbox becomes unchecked even though Coffee was never submitted. The controls remain usable during the save, so the next batch is lost. Scope changes can suffer the same unconditional clear (inferred from the completion path; manual reproduction used a new selection within the same scope).

Fix: bind completion to a captured selection generation and scope, and clear only when that generation still owns the selection. Do not steal focus or overwrite a newer Undo/result/error on a stale completion. Apply the same rule to selection approval. Add one delayed-completion step to the existing selection journey. Evidence: `manual.ts`, `late-before.png`, `late-after.png`, and corresponding ARIA snapshots in this report's directory.

### P2: One deleted previous Category makes every restoration impossible (verified)

`convex/transactions.ts:531`; generic recovery message at `src/lib/components/transactions/transaction-table.svelte:638`.

Apply a bulk Category/approval, delete its now-unused old Category, then Undo. The owner throws `NOT_FOUND`; the whole mutation rolls back, including otherwise valid Category and approval restorations. Repeated “Try again” cannot repair the deleted reference. This is a routine Category-management conflict, not a transient failure.

Fix: explicitly handle a missing old Category. Recommend retaining that row's current Category, undoing eligible approvals and other valid rows atomically, and returning a restored/skipped summary that names the conflict. Do not silently choose another Category or resurrect the deleted one. Add this to the owner Undo case. Evidence: `owner-probes.ts` and `probes.log`.

### P2: Value matching does not preserve a later action returning to the same state (verified for approval)

`convex/transactions.ts:526` and `:529`.

Bulk categorize-and-approve; subsequently unapprove and explicitly approve that Transaction; call the old Undo. It unapproves the later approval. Likewise a Category changed away and back to the bulk Category is indistinguishable from an untouched bulk result (Category scenario inferred from the identical equality guard). This is a narrower guarantee than “a later change wins.” Ordinary unrelated memo/amount changes are retained because the current Transaction is read again before writing; the defect concerns intervening Category/approval decisions.

Fix: use field-specific revision/operation ownership in the receipt, compared by Undo, so unrelated memo edits still allow restoration. If the product intentionally accepts value-based best effort instead, explicitly narrow the ticket's promise and obtain that decision; do not describe it as preserving every later change. Extend the existing owner Undo case with the intervening action. Evidence: third probe in `owner-probes.ts`.

## Atomic mutation, memory, and capacity assessment

`categorizeMany` validates size and all selected Transaction restrictions before writing, deduplicates IDs, and runs in one Convex mutation. Errors during Category validation also roll back the mutation. It categorizes with `remember` absent and approves only on explicit request. Category alone preserves prior approval, including already-approved rows. Undo skips missing Transactions, Splits/Transfers for Category restoration, and reconciled approvals. Reconciled rows may change Category under the existing domain rules; reconciliation locks money/date/Account, not every field. No raw write or ADR 0002 conflict found.

The 250 bound is shared by UI and both endpoints. The capacity harness calls the real endpoints at the bound, verifies persisted Category/approval/totals counts before and after, and measures both apply and Undo against backend limits. It is meaningful proof for the synthetic scenario, not a mathematical worst-case guarantee for every possible history. It uses one Cash Account, one prior Category, 60 months, long Payee/memo text, and a Bank Row per Transaction. Cross-Account/card correctness was separately checked by the cache probe. Keep the bound; do not raise it for groups or transparently split one atomic action into multiple calls.

## Recommended answers to the six open questions

1. **Deleted previous Category:** change it as described in P2; retain current Category for the conflicting row, restore eligible parts, and report skips.
2. **Debounced search clears recent checks:** safe for the current scope rule; accept now. Prefer clearing/announcing immediately on search intent, or preventing selection while results are pending. Never preserve checks by row position or silently carry them into new results. This is distinct from the verified pending-save bug.
3. **Phone Payee wrapping:** minor usability cost; accept for 07 with a focused polish follow-up in 08. Full names remain available and controls pass the narrow-screen journey. Preserve readable full names; avoid sacrificing touch targets to reclaim width. Group headings may reduce repetition, but inspect the resulting real phone layout.
4. **Transfer UI proof:** add a small step to the existing selection journey. The fixture already exposes two Transfer rows in the loaded list; they need not be Unapproved to select them. Manual check here verified the exclusion note and disabled bulk picker. Prefer a mixed ordinary/Transfer selection to prove the ordinary row changes while the Transfer remains intact.
5. **Bulk Remember:** keep outside 07. Ticket 08 does not actually require adding it either; defer unless separately chosen. If added, name affected Payees and handle conflicting choices per Payee explicitly. Never infer future memory from a bulk Category write.
6. **Empty opt-in hint:** add concise help: “Marks these Transactions reviewed. Balances already include them.” Keep the default unchecked and reset each opening. Empty hint is supported accessibly and is not itself a blocker.

## /correct — recurring mistake and enforcement

**Class:** a response is assumed to still own current UI state. Evidence: ticket 05's recorded late Category-save/superseded Transfer work needed latest-pick gating, and ticket 07's bulk completion now clears a newer selection. These are two real occurrences, not speculative style concerns.

**Highest practical level: architecture.** Put selection completion ownership behind the existing selection boundary: capture an action's scope/generation and selected IDs, then expose completion that only consumes the matching generation. Gate the table's result/Undo/error/focus ownership with the action identity as well. Use it for bulk categorize and selected approval; do not build a general workflow framework.

Types alone cannot determine whether a response arrived after a user changed selection; lint can ban one syntax while missing equivalent stale writes. A generation-aware boundary structurally prevents the mistaken operation. Add one held-response behavior assertion as proof: it must fail with the current unconditional clear and pass after the fix, retaining the new Coffee selection. Existing ticket 05 delayed-response proof remains its separate row-lifecycle owner. No second speculative correction is proposed without two concrete occurrences.

## Checks and evidence

- Dependency setup: `bun install --frozen-lockfile`, exit 0. Initial startup/tests could not run without dependencies; this was corrected. No `EAI_AGAIN` occurred.
- `app up`, `doctor`, `login`, `seed budget-with-accounts`: exit 0. Authenticated Budget heading and seeded Groceries control verified (`readiness.ts`, `readiness.log`). Private auth state was not copied into evidence.
- Focused owner/cache/auth/map: **32 passed**, 1.65 s (`owner-tests.log`).
- Three independent review probes: **3 passed**, 0.64 s (`probes.log`). Temporary test file was removed; rerunnable source retained as `owner-probes.ts` (copy to `convex/ticket07review.test.ts`, run the focused runner, then remove).
- Maintained journeys: **4 passed** — `transactions/select-categorize`, `transactions/approve-all-undo`, `transactions/categorize`, `transactions/approve-phone`; includes desktop 1280×800 and phone 320×640. Evidence: `../verify-budge/ticket-07-review/summary.json`, screenshots, snapshots and traces. Reviewed the phone capture for readable names and reachable actions.
- Manual keyboard selection with Space and picker with Enter/search, delayed bulk completion, reload persistence, and Transfer exclusion: observed as above; final manual script exit 0. Early probe iterations incorrectly waited for new query results while the response helper held all subsequent transitions; those interrupted attempts are not product failures. `manual.log` contains interleaved output from an earlier interrupted attempt; the before/after artifacts and final script provide the decisive result.
- Scoped ESLint and `lint:ui`: exit 0. Broad `lint` terminated with exit 143 without findings; scoped lint covers the changed executable files.
- Full unit suite: **908 passed**, 58 files, 28.83 s, exit 0 (`all-tests.log`). `capacity:check`: **passed**, exit 0, 114.68 s (`capacity-check.log`). At 250, both bulk operations used 1,456/4,096 database queries, 3,880 documents read and 1,250 written. Apply took 0.496 s and Undo 0.493 s; bulk metrics were all below half the enforced limits. Both persisted-state checks passed. Raw metrics are retained under `../capacity/2026-11-14T02-24-30.272Z/`.
- Baseline failure demonstrations/mutation probes in the implementation ticket were read as claims, not rerun by this review. No application edits, commits, or test-only production seams were added. Three-judge UI approval remains the coordinator's separate shipping gate; this is the requested local review.

## Principles that changed the review

**Prove It Works / Test Behavior, Not Implementation:** checked persisted state and actual controls, compared cache rebuilds, and used real held-response traffic rather than private helper calls. **Encode Lessons in Structure:** proposed selection ownership at its boundary after locating the second stale-completion mistake. **Laziness Protocol / Minimize Reader Load:** retained the existing owners/picker and recommend one lifecycle correction rather than replacing selection for 08. **Experience First:** treated lost selection and irrecoverable generic Undo errors as user problems while keeping phone wrapping and concise hint copy proportional. **Model the Domain / Type System Discipline:** distinguished state equality from ownership of a later decision; a receipt needs more than a boolean to promise causal Undo. **Separate Before Serializing Shared State:** owned only this checkout's backend and ran browser, capacity, and teardown phases serially.

Cleanup: `bun run app down` exited 0. App lifecycle ownership released; `.local-app/running.json` is absent. Evidence retained and checked nonempty after teardown. Final `git status --short` and `git diff --check` are clean.
