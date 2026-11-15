# Move snapshot — focused Spec recheck

**Source pass; no Spec findings.** Reviewed exactly `git diff d41e5eb...2ff1448` (four files), with HEAD verified as `2ff144820f1bb0ddc3301c5d4f377383d16c337a`.

The spec requires preserving money semantics and explicit From/To context (spec Outcomes and item 4). Ticket 06's standards-S1 disposition requires the announcement to describe the submitted move while preserving a newer Amount draft. `src/lib/components/budget/category-inspector.svelte:143–155` captures submitted endpoints, amount text and cents before awaiting, sends those endpoint IDs/cents, and announces those names/cents. Swapping pending controls cannot reverse the announcement; a different draft Amount survives completion. `:162–171` captures Cover's name before awaiting without changing the Cover operation or error/focus behavior.

`e2e/journeys/inspector.ts:73–104` extends the existing public journey: submit $10 Groceries → Coffee, hold incoming sync, swap, type `7.00`, resume, assert the exact submitted announcement, retained draft, both $10 balance changes after completion and reload, then reverse the move. The existing `pausableSync` implementation (`e2e/heldResponse.ts:185–210`) forwards requests to the real server and queues responses; it does not fabricate the asserted mutation result. Feature-map and ticket changes describe this bounded repair; no unasked product scope found.

Principles applied: Experience First centered truthful feedback and draft preservation; Test Behavior, Not Implementation/test-audit favored observed messages, input and persisted balances; Laziness Protocol and Guard the Context Window kept review to this repair and its necessary transport dependency. Prove It Works limits this verdict to inspected source.

No tests, app, or browser run; parent owns concurrent verification. Ticket-recorded red/green claims were not independently validated here. This is not browser approval or ticket completion.
