# UX efficiency simplification

Status: ready-for-agent

The owner approved implementation of the 26-item audit in this conversation, followed by local review, three-judge UI review, one integration PR, CI and CodeRabbit monitoring, merge to main, production deployment, and deployment verification. Fresh Opus 5.5 agents own implementation and production/UI fixes; Sol coordinates shipping. This authorization supersedes the earlier Sol-only audit restriction. Do not ask again for already authorized shipping actions.

## Outcomes

Implement all numbered items below, keeping their identifiers in verification and disposition records. Opus owns concrete design/API choices. If an item conflicts with observed usability or safety, record evidence and resolve the choice explicitly rather than silently dropping it. Preserve money semantics, existing data, keyboard access, focus return, accessible names, approval/Undo scope, and immutable Starting Balance rules. Synthetic data only.

### Budget and Categories (ticket 01)

1. Assigned editing directly accessible on narrow phones, including 320px, without opening the full inspector.
2. Assign the needed Target amount directly from the budget table without opening the inspector.
3. Cover overspending from another Category without retyping the calculated shortfall; keep the Ready to Assign shortcut.
4. Replace the move form's direction interpretation with explicit From and To context and amount.
5. Search Categories in the move form rather than scanning a plain SelectField.
6. Add a Category from its Group with that Group selected.
7. Create a missing Group within the Add Category flow, avoiding a separate prerequisite creation trip.
8. Rename Categories and Groups in place.
9. Directly reorder Categories and Groups without repeated menu-open/Move up/down operations; keyboard and touch access required.
10. Manage the selected Category from Budget without navigating away and finding it again.
11. Collapse Budget Groups, retaining totals and visible overspending indicators.
12. Jump directly to month/year through the month heading, retaining arrows and cutover boundary.

### Transactions (ticket 02)

13. Removable active filter chips remain visible outside the collapsed Filters panel.
14. Searchable Category filter.
15. Searchable exact-Payee filter, preserving exact identity semantics distinct from free-text search.
16. Common date-range presets alongside custom From/To dates, using local dates.
17. Add Transaction from a named Account uses compact Account context with Change; preserve All Accounts selection and editing behavior.
18. Empty optional Transaction memo collapses behind Add memo; populated memos remain visible.
19. Empty split-line memos appear on request; populated ones remain visible.
20. Save and add another for manual Transaction entry retains Account/date and starts a clean draft without duplicating saves or keeping prior amount/memo unintentionally.

### Copy (ticket 03)

21. Delete the sign-in tagline, keeping heading and sign-in controls.
22. Delete Theme's sentence 'Light and dark both keep every amount readable.'
23. Delete Categories' introductory paragraph listing its management actions.
24. Delete 'No Target yet.' beside Add Target.
25. Shorten Settings export intro to 'Download CSV or JSON.' Keep consequential export-dialog details.
26. Shorten the empty Budget inspector prompt to 'Select a Category.'

Do not sweep in all raw Luna suggestions. Preserve estimate uncertainty, import format support, historical money effects, irreversibility, Undo limits, and warnings needed to decide safely.

## Verification and delivery

Use the maintained browser-journey public seam in e2e/journeys and verify-budge, plus existing public domain/backend interfaces where logic needs unit coverage; avoid tests mirroring UI implementation. Follow tdd where the established seam permits, and test-audit for all changed tests. Typecheck and focused tests per slice, full bun run check and isolated E2E suite at integration. Update feature-map entries for every changed feature and journey. Never run sync/check/typecheck during an active app session in that checkout.

Use docs/quality/ui-review/README.md and rubric.md: independent fresh Sol A High, Sol B High, and Opus 5.5 judges; isolated worktrees; desktop 1280x800, phone 320x640, keyboard tasks and targeted 390px/dark/edge-state coverage. Each must approve the same final revision at >=9/10 with full required coverage and no major/blocker. Disposition all findings. Local code-review Standards and Spec axes and analysis-only corrections remain required. Opus resolves and implements accepted corrections.

One PR from feat/ux-efficiency into main. No child pushes, PR creation, merges or production writes. Parent owns integration and shipping. Keep CodeRabbit automatic review disabled; request review only once prepared and CI green, batch repairs and incremental re-review. Require explicit CodeRabbit approval covering latest head plus green CI before merge. Main's existing Vercel integration deploys production frontend and Convex; verify resulting deployment and logs, plus a read-only live smoke test. Never seed production. Record authenticated production coverage honestly if owner session is unavailable.

## Task record

- Baseline: clean main matching origin/main on 2026-11-14; exact base recorded in state.md.
- Implementation: pending.
- Reviews, checks, deployment: pending.
