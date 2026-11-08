# 03: A Transaction editor module behind the dialog

**Status:** ready-for-agent

**Spec:** [Agent ergonomics](../spec.md), scope 3

**Blocked by:** 01 (the dialog uses the new opening module)

## Problem

`src/lib/components/transactions/transaction-dialog.svelte` is ~837 lines. One string holds the selection: a Category id, `'transfer:'…`, `'split'`, or unresolved (`const TRANSFER = 'transfer:'; const SPLIT = 'split';` ~106-107). A loading or failed lookup has collapsed into a valid Uncategorized save at least 3 times. Editing rules (Payee recall, manual override, switching to split, direction change, Transfer) can only be exercised through Playwright.

## What to build

- A framework-free editor module (pure TypeScript; Svelte runes only in the adapter) that owns the draft: date, amount and direction, Payee, memo, the selection as a discriminated union (loading · failed · resolved · chosen Category / Transfer / split), split lines, and the derived "ready to save" and save payload.
- Encode it so an unresolved selection cannot produce a save payload.
- The dialog becomes a thin adapter: it renders state, feeds query outcomes and user events into the editor, and sends the payload. Server validation stays authoritative.
- Unit tests own the transition rules. Browser tests keep only wiring, a11y, and the end-to-end save. Delete E2E assertions that only re-prove transition rules the unit tests now own, if any.

## Acceptance

- [ ] The selection type cannot represent "save while loading/failed"; a test proves the editor yields no payload in those states.
- [ ] `transaction-dialog.svelte` holds no editing rules beyond wiring (line count reported).
- [ ] `e2e/transactions.test.ts`, `e2e/splits.test.ts` and the other dialog E2E pass; `bun run check` passes.

## Comments
