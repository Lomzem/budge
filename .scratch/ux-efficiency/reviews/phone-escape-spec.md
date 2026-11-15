# Phone Escape — Spec review

0 production findings. Reviewed `git diff cf4a0cf...ce0dad7` (five files; sole commit `ce0dad7`, cherry-pick of `5bf5ae6`). No source edits, app/browser runs, commits, or additional delegation.

Contract: `.scratch/ux-efficiency/spec.md:9` preserves keyboard access, focus return and money semantics; ticket 06 dispositions `opus-5` and `sol-a-A1` (`issues/06-ui-audit-repairs.md:26,28`) require dirty Escape to clear and retain the inspector, then clean Escape to close.

`category-inspector.svelte:115–120,207–208,442–445` clears Category/Amount/refusal/invalid state, focuses the picker, and prevents the section close for that event. `+page.svelte:291–293,676` cancels only the phone Dialog's own Escape close while focus is inside the inspector. These paths introduce no writes. Desktop behavior retains its existing handler.

Installed API source confirms the mechanism: bits-ui `utilities/escape-layer/use-escape-layer.svelte.js:31–39` clones Escape, explaining why the original prevention alone failed; `dialog/components/dialog-content.svelte:56–59` honors prevention of that clone. Escape-layer lines 42–54 route only the topmost closing layer, preserving nested Dialog ownership.

`e2e/journeys/inspector.ts:158,175–198` directly asserts 320px dirty/error clearing, retained dialog, picker focus, second-Escape closure, returned focus and unchanged Coffee Assigned; desktop focus is asserted at :127.

Prior Opus-checkout `test-results/verify-budge/{red-phone-escape-2,green-phone-escape,green-phone-escape-targets,green-phone-escape-2}/summary.json` records the phone regression failing then passing and affected journeys passing. Metadata says `93a959f` plus uncommitted changes: this is prior evidence, not fresh exact-head proof. `targets/monthly` saves a desktop Target before switching width; it does **not** prove nested phone Escape. Fresh rendered approval remains the parent's gate.

Principles applied: Experience First and Test Behavior prioritize observable focus/clearing; Prove It Works limits artifact claims; Laziness Protocol and Guard the Context Window keep review scoped.
