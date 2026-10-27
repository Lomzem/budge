# Map: Budge v1 spec

Labels: wayfinder:map

## Destination

A build-ready v1 spec for Budge: scope, budget rules, sync approach, data model, stack, and UI rules all decided, so implementation (`/to-spec` → `/to-tickets`) starts with no open questions. The map stops before implementation.

## Notes

- **Domain**: a personal, single-user, YNAB-style zero-based budget. Use the vocabulary in `GLOSSARY.md` (Ready to Assign, Assigned, Activity, Available, Target, Payee, etc.).
- **Audience**: the owner only. No external customers, no multi-user. The repo is public (for free CodeRabbit reviews), so it holds code only: no data, no secrets.
- **Accounts**: Capital One checking, Capital One savings (if present), Discover credit card, plus manually tracked accounts. USD only.
- **Bank sync**: automatic sync is wanted if an aggregator supports Capital One and Discover for at most $25/year. CSV/OFX import is the guaranteed fallback.
- **Stack (decided)**: SvelteKit, Bun, TypeScript, ESLint, Prettier, shadcn-svelte, shadcn-lint (`@shadcn/lint`), lefthook pre-commit hooks. Convex Cloud (free tier) for the backend. Clerk for auth, locked to one user. Vercel for hosting.
- **Effect**: the TypeScript side uses the Effect library heavily. Where exactly it applies (Convex functions, schemas, sync, UI) is decided by the Effect tickets.
- **Copy YNAB by default**: when a behavior isn't decided by a ticket, do what YNAB does; tickets record any deliberate difference.
- **Security**: encrypt bank-sync tokens at rest where practical. Convex storing the data on its servers is acceptable.
- **iOS**: installable PWA through Safari. Online-only in v1.
- **Testing**: budget math is built test-first (Vitest, `/tdd`); the UI gets light Playwright smoke tests.
- **UI rules** (from the `visual-report` skill):
  - No badges or pills. Write status, category, and count labels as plain text: a word in a sentence, a table column, or a label beside its value.
  - No corny subtitles or taglines. Each heading is a plain label for its content, with the content directly beneath it.
  - Lay out sections with headings, whitespace, and dividers. Use a card only for one item in a set the reader compares side by side.
  - Accessible, WCAG 2.2 AA in both themes: use the theme color tokens; give every control a visible label and a keyboard path; give every chart a text equivalent.
  - Dark mode support, with light mode too.
  - Responsive from 320 CSS pixels wide up to desktop.
  - Build with shadcn-svelte components and semantic HTML. Beautiful.
- **Skills**: grilling tickets call `grilling` and `domain-modeling`; prototype tickets call `prototype`; research tickets call `research`. UI work consults `visual-report` for the rules above.

## Decisions so far

<!-- one line per resolved ticket: [title](issues/NN-slug.md): gist -->

- [What is in v1 and what waits?](issues/05-v1-scope.md): v1 has splits, Transfers, credit-card model, Monthly (with due day) and repeating By date Targets, an Upcoming list, simple reconciliation, Payee memory, search, any-month editing, Category management, move money, manual Accounts, and export; scheduled Transactions, reports, Payee rules, and tracking Accounts wait.
- [Which aggregator syncs Capital One and Discover for at most $25 a year?](issues/01-bank-sync-provider.md): Plaid Trial (free, 10 lifetime Items), SimpleFIN Bridge as fallback; Capital One gives no pending transactions.
- [What is the current state of SvelteKit with Convex, Clerk, and Vercel?](issues/03-stack-integration.md): it fits; pin SvelteKit 2 for `svelte-clerk`, Clerk Invite-only plus an owner guard in every Convex function, sync and AES-GCM token encryption in Convex actions; Clerk production needs an owned domain.
- [What export files do Capital One and Discover offer?](issues/02-bank-export-formats.md): Capital One 360 offers CSV and QFX (with FITID); Discover offers CSV with positive purchase amounts and no IDs; migrated Discover cards export through Capital One.
- [What can an iOS PWA do in 2026?](issues/04-ios-pwa.md): Home Screen web app works without Apple membership; v1 ships a manifest only, no service worker; never cache Convex or Clerk; Clerk sessions need real-iPhone testing.
- [What are the exact budget rules?](issues/06-budget-rules.md): one formula, Available = prior + Assigned + Activity, with negatives carried forward (no YNAB month-end reset); one global Ready to Assign that may go negative; card purchases move their full amount to the Payment Category; Uncategorized counts as Ready to Assign; Monthly Targets refill up to or set aside; By date Targets spread over months left and repeat after the due month; only Transactions and Assigned are stored.
- [How does Effect fit with Convex and SvelteKit?](issues/13-effect-fit.md): Effect 4 is stable; recommended for domain workflows, external-data decoding, Plaid orchestration, and tests behind native Convex and Svelte boundaries; Confect 10.x is viable but not the starting foundation.
- [How do synced Transactions arrive?](issues/07-import-flow.md): YNAB-style: imports count at once but arrive Unapproved and Cleared; pending ignored; one matcher (import ID, then same Account, amount, within 10 days, single candidate) for sync and file; Payee from Plaid `merchant_name` with Bank Text kept, exact-text rename memory, Category from Payee memory; Transfers matched via a created counterpart.

## Not yet specified

- **Offline support**: read-only cache or queued edits, for a later version.
- **Notifications**: whether anything (Overspending, sync failure) is worth a push notification on the PWA.
- **Assembling the spec**: collapsing the resolved decisions into the final v1 spec, once the tickets above are resolved.

## Out of scope

- Reports: ruled past v1 by [What is in v1 and what waits?](issues/05-v1-scope.md); they read data v1 already stores, so they can be added later without changing it.
- YNAB import: start fresh on a cutover date; YNAB import will never be supported.
- Native iOS app: no Mac or Apple Developer account; the PWA covers iOS.
- Multi-user, sharing, and external customers.
- Multi-currency.
