# Ticket 09 review

Reviewed HEAD `53c64bfa81ba8057461d45c9dabee49ceb5f5e4c` against `b8d5b29` using `git diff --no-ext-diff --no-textconv b8d5b29..53c64bf`. The range contains `6394a8f`, `545770c`, `1efd6f4`, and the landed record `53c64bf`. Analysis only; no commits or production changes. All bank data and responses were synthetic.

The reviewer brief forbids further delegation, so both code-review axes were performed inline, with the test-audit lens. Sources: AGENTS.md, the complete review brief, ticket including Comments, first-use UX spec, glossary, authentication/domain instructions, relevant ADRs, Convex guidelines, and verification feature map.

## Standards

No new non-tool-enforced documented-standard violations or actionable Fowler-baseline smells found. The shared report formatter and single ownerSync boundary keep the change small. The new WebSocket answer mechanism is confined to E2E tooling, with no test-only production seam. The two usability issues below are reported on the Spec axis rather than counted twice.

## Spec

### P2 — Matched details have no usable disclosure on narrow touch screens

**Location:** `src/lib/components/bank/connection-card.svelte:358` (new detail at line 360; enclosing fixed slot/title at line 340).

**Requirement:** “Keep other diagnostic counts in details.” The result appends the matched detail inside the same two-line clamp as the primary result. At 320×640, a synthetic `{added:123, matched:123, held:123}` Sync now response produces 96 px of text in a 48 px box. The screenshot shows only the beginning of the matched number, not what it means. The Reconnect prefix consumes still more space. Native hover title and an announcement do not provide a discoverable, repeatable way for a sighted touch user to read this detail.

**Fix:** retain the compact additions/waiting summary, but expose diagnostic text through a keyboard- and touch-operable Details disclosure. Ensure the primary waiting instruction remains readable for long supported counts and Reconnect wording. Reserve the needed space before completion if layout stability is required.

**Verified:** browser dimensions, DOM measurement, and screenshot in `clipped-result.png`; Reconnect's additional wrapping is inferred from its prefix and shared renderer. The mocked run proves presentation only, not actual bank effects.

### P2 — Late completion replaces newer feedback on the same card (existing behavior)

**Location:** `src/lib/components/bank/connection-card.svelte:204`, shared `result` assignments at lines 172, 181 and 210. This handler predates the ticket; the implementer explicitly asks for its disposition. It is not a newly introduced regression.

**Scenario:** click Sync now, withhold its response, choose Stop syncing in the card menu, wait for “Stopped syncing …”, then release a successful zero result. The status changes to “No Transactions added.” The Account remains ignored, including after reload. Thus the latest deliberate action loses its acknowledgement even when there is no sync failure to preserve. Bring back has the same unguarded result ownership.

**Fix:** generation ownership for transient card feedback; every new card operation advances the generation, and only its owner publishes completion/focus changes. Preserve sync failures independently, via durable connection problems and a separate visible error channel for failures not persisted by the server. Do not serialize unrelated operations solely to protect one message slot.

**Verified:** real Stop syncing mutation and reload, intercepted synthetic Sync now response. See `browser.log`, before/after screenshots and `browser.ts`. Bring back/Reconnect overlap is inferred from the same assignments.

## Counts, entry points, and test-audit

- **Sync now:** the added server test at `convex/plaidWebhook.test.ts:658` calls the actual public action against fake Plaid HTTP responses. It expects `{added:2, matched:0, held:3}`, then all zeros on a quiet run while earlier held work remains. This catches the actual dropped-held defect and a running-total substitution.
- **Reconnect:** `syncAfterReconnect` uses the same ownerSync mapping and validator (`convex/bankConnections.ts:457–492`); no incorrect mapping found. Its existing integration test checks discovery/persistence but does not assert returned counts (`convex/plaidWebhook.test.ts:676`). Successful Plaid Link itself remains unverified locally.
- **Arithmetic:** `convex/lib/sync.ts:256–321` initializes totals per invocation and sums each committed batch. Existing integration proof includes a positive match (`convex/bankConnections.test.ts:316`) and a held-only run (`convex/heldAccounts.test.ts:192`). Public matched-positive and held-only receipts are inferred through the shared mapping rather than independently asserted at that boundary. Extend the existing public outcome test with these cases and both owner entry points if closing that coverage gap; do not duplicate arithmetic at every layer.
- **Webhook/daily:** internal sync deliberately returns null (`convex/bankConnections.ts:211–224`). It uses the same arithmetic but neither persists nor publishes an added/matched/held receipt. Existing webhook tests prove signed dispatch, arrival, repeat handling and held-account discovery. Therefore a claim that *every entry point displays this run's counts* would be false. The current spec/map describes automatic arrival/freshness rather than an automatic receipt; this review does not invent a webhook-toast requirement. A persistent latest-run receipt would require an explicit scope decision.
- **Browser stand-in:** `answerInsteadOfServer` consumes the action request before it reaches Convex. `plaid/sync-waiting` proves client result dispatch, copy, placement, keyboard route into an already seeded setup dialog, and widths 320/390/1280. It proves neither server validation/calculation nor that this sync created the held rows. The public fake-Plaid test covers the dropped-held transport gap for mixed/zero runs; the stronger arithmetic cases live at the integration owners above. This division is legitimate and accurately labelled.
- **Green check:** source inspection confirms both idle and completed-result branches require no connection problem, no feed needing setup/history correction, and no held Account (`connection-card.svelte:134,353,363`). Success does not confirm a Starting Balance. No new incorrect branch found. The selected browser fixture has other problems, so its success alone cannot isolate the new held-only icon guard; no exhaustive icon claim is made.
- Report tables use independently specified strings and exercise the real formatter. They protect rendering, not arithmetic. No new production seam, copied implementation inventory, or redundant arithmetic proof found. The new public test checks a real boundary; the browser test covers a distinct interaction/layout risk.

## /correct — repeated classes and structural remedies

1. **Stale asynchronous work owns newer UI state.** Evidence: ticket 05's empty Transfer-candidate result overwrote a newer Category; ticket 07's bulk completion cleared newer selection; the reproduced card race above is another occurrence. Highest useful enforcement: a card-local operation-generation boundary covering result and focus publication. Types alone cannot establish temporal ownership; lint would depend on syntax, while a general workflow framework is unnecessary. Keep durable sync errors independent of transient feedback. Proof: delay Sync now, complete Stop syncing/Bring back, then release older success/error; assert latest acknowledgement/focus survive and any failure remains visible. This would reject the recorded ticket-09 race; the analogous generation guards fixed 05/07.
2. **Success copy is shortened to fit one sample, rather than making the information accessible.** Evidence: ticket 09's own record says its original waiting wording failed at 320 px, and this review reproduces clipping again once matched detail/long counts are present. Highest useful enforcement: separate primary summary from an accessible diagnostic disclosure, so diagnostic length cannot consume the primary slot. Types/lint cannot guarantee wrapping across fonts and widths. Extend the existing layout journey with one worst-case Reconnect/held/matched result and reachable Details, rather than another small-count screenshot journey. It would catch both the original waiting-text failure and today's unreadable detail. Baseline red proof of this proposal has not been run.

## Recommendations for the three questions

1. **Changed/removed rows:** yes, when nonzero, in optional details. “No Transactions added” is truthful but incomplete when balances changed or Bank Changes need review. Count actual applied changes/removals separately from items requiring the owner; do not relabel these as additions or use the total backlog. This is a follow-up scope decision, not a missing ticket-09 acceptance criterion.
2. **Late results:** use generation ownership. Retain failures separately; hiding the latest acknowledgement is not necessary to preserve an error. Do not accept last-completion-wins as the permanent trade-off.
3. **320 px clipping:** do not accept title plus screen-reader announcement as the sole detail access. Supply a touch/keyboard disclosure, keeping additions and actionable waiting setup visible.

## Checks and evidence

- Initial commands were blocked by absent dependencies; `bun install --frozen-lockfile` succeeded. Its lifecycle sync ran before app startup, with no journey active.
- `bun run test -- src/lib/bankConnections.test.ts convex/plaidWebhook.test.ts convex/bankConnections.test.ts convex/heldAccounts.test.ts`: **133/133 passed**, 4 files, 2.38 s. No comparative baseline timing or red run was performed by this reviewer.
- `bun run app up`, `doctor`, `login`, and initial `seed budget-with-accounts`: exit 0. Doctor reported every check OK. Authenticated Budget/fixture readiness passed at desktop width; the initial phone readiness attempt failed because the Assigned control is absent in that layout, then was corrected to desktop.
- `bun run app verify plaid/sync-waiting plaid/late-sync plaid/attention plaid/late-renew --run t09-review`: **4/4 passed**, with screenshots, ARIA snapshots and traces under `../verify-budge/t09-review/`; see its `summary.json`.
- `bun test-results/ticket-09-review/browser.ts`: exit 0; reproduced race, persistence and clipping. Run after the journey driver completed. Browser closed in finally.
- `bun run app down`: exit 0; app stopped. Evidence remains nonempty. Tracked worktree clean. No full check/sync during browser driving, real Plaid credentials, production writes, or commits. Broad repository/full E2E gates and three-judge UI review were not repeated for this analysis-only review.

## Principles that changed this review

Test Behavior, Not Implementation and Boundary Discipline separated rendering proof from fake-Plaid public-action proof. Prove It Works led to direct reproduction and reload of the real stop mutation. Experience First rejected hover-only access on a phone. Encode Lessons in Structure and Separate Before Serializing Shared State led to generation ownership plus a distinct error channel, not blanket disabling. Laziness Protocol kept recommendations within the existing formatter, public outcome owner, and card boundary. Model the Domain, Type System Discipline, and Minimize Reader Load informed inspection of the result union and ownership; no additional abstraction is justified.

**Axis totals:** Standards 0; Spec 2 P2 issues (one existing race requiring disposition, one detail-access issue). No P1 found. Recommend addressing these usability decisions before final acceptance; count arithmetic itself appears correct within the stated proof limits.
