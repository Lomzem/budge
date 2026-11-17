# Agent budget access

Design interview in progress (resumed 2026-11-16; owner wants to proceed to implementation once the remaining decisions settle). No implementation is authorized by this record yet.

## Desired experience

Start a T3 Code thread and ask an agent to inspect a month's Transactions and budget and offer recommendations. Also explore categorization: the agent proposes Categories for recent Transactions, shows its decisions, and applies changes after the owner approves them.

## Settled constraints

- Budge is for this owner alone indefinitely; a multi-user integration platform is outside scope.
- Stay on the free tier as long as practical. Bounded reads, batching where useful, and abuse controls matter; a batch is not itself evidence of lower database usage.
- First-release writes include recategorizing existing Transactions (including already categorized Transactions) and creating Categories and Category Groups, after review and approval. No changes to amounts, dates, Payees, deletion, or money assignment are requested. Split handling remains open.
- Connected agents may read the whole budget across Accounts and history, in bounded portions as needed. Bank credentials and authentication secrets are outside this access.
- Show proposed categorization decisions before writing. Owner accepts conversational approval in T3 Code and trusts the agent to wait for approval; server scope enforcement does not independently prove human approval.
- Same-machine cache reuse with download-time labeling and deliberate refresh is accepted; no continuous polling initially.
- Product direction is a decoupled extension with approval in T3 Code, rather than requiring Budge UI. Opus design advice obtained; product trust boundary accepted, implementation enforcement design remains open.
- Agent reclassification must leave remembered Payee Categories unchanged.
- Include reviewable undo that preserves later owner changes and retains newly created Categories that have since been used.
- Leave the existing checkout and the other active thread alone. Documentation lives on `docs/agent-budget-access` in `/home/lomzem/proj/budge-agent-access`, fast-forwarded onto `main` 2a7e56e on 2026-11-16 with these notes preserved. Note: `main` deleted ADRs 0001–0003 (35aa11d), so the ADR 0003 citation below refers to history, not a current record.

## Decisions settled 2026-11-16

- Q12 accepted: at apply, Budge refuses each change whose Transaction no longer has the Category the agent read; other changes in the Categorization Proposal still apply, and the agent asks again about the refused ones.
- Q16 accepted: no local cache in the first release. Reads are live and bounded; measure real usage before building a cache (supersedes the Q7 cache for now).
- Q17 accepted: page caps on reads and a cap of about 100 changes per apply; no daily quotas.
- Q18 accepted: one setup command on this machine registers Budge for both Claude and Codex at user level, so any T3 Code thread in any folder can use named Budge tools.
- Q19 accepted: one agent key; Budge stores only a fingerprint; the key lives in a private local file; it can read the budget, recategorize, and create Categories and Category Groups only; no expiry; revoke or rotate by command; no new Budge screens.
- Q20 accepted: every applied Categorization Proposal is recorded; undo runs through an agent in chat, reverts only Transactions still in the agent's Category, and removes new Categories nothing uses yet. No Budge page for agent changes in the first release.
- Q21 accepted: two tickets on one integration branch and PR: read access first, then proposals, apply, conflict handling, and undo.
- Q22 accepted: Budge refuses an agent-created Category or Category Group whose name matches an existing one, ignoring case; the agent reuses the existing one.
- Q23 accepted: agent recategorization leaves Unapproved Transactions Unapproved, and the agent cannot move Transactions into hidden Categories.
- Q11 accepted: the agent may change the Category of Reconciled Transactions and of existing split lines; it cannot add, remove, or resize split lines, and cannot change Transfers or Starting Balances.
- Q15 accepted: the agent proposes only changes it is sure of, lists unclear Transactions as questions, and adds a change only after the owner answers.

Scout evidence (verified by parent at `convex/transactions.ts:477-560`): `categorizeMany` rejects splits and Transfers and never changes Remembered Categories; `undoCategorizeMany` restores only Transactions still in the bulk Category, with the change record held by the caller today. Category and Category Group creation does not check duplicate names (`convex/categories.ts:58`). The only HTTP route is the Plaid webhook; no agent credential exists.

## Open decisions

No product decisions remain open. Architecture is Opus-owned and is proposed below, pending owner confirmation of the shared understanding.

## Investigation evidence

Read-only scout inspected the active checkout without modifying it. Parent verified `convex/lib/owner.ts` and ADR 0003: existing owner credentials admit both reads and writes, and each deployment holds one owner's budget. Agent credentials therefore cannot simply reuse the owner's session while claiming read-only access. Other reported findings need verification against the implementation baseline before design is finalized.

Reported existing building blocks: monthly budget read, filtered paginated Transactions, monthly totals cache. No existing agent access or scoped credential facilities were found. Current platform allowances and the cost of agent workflows are not yet measured or verified.

Cache scout findings on this worktree: current export paginates full tables without a revision or common snapshot contract (`convex/export.ts`); schema has no general change feed or deletion tracking (`convex/schema.ts`). Transaction dates and Bank Connection cursors cannot detect all edits and deletions. Existing export is not an approved agent-facing data surface. Efficient incremental refresh and consistent publication of a completed cache require architectural decisions. Existing `.local-app/` state is checkout-local; a machine-wide cache would be new. Filesystem sharing is established for collaboration agents in this runtime, not every independent T3 thread or remote host. Local reads can avoid cloud calls, while refreshes and writes still incur usage per https://docs.convex.dev/production/state/limits. No actual usage measured.

## Pending interview round

- Q7 accepted: reuse same-machine cached data with download-time labeling and deliberate refresh, without continuous polling.
- Q8 Budge approval rejected: user wants a decoupled extension and asks for approval in T3 Code. Security trade-off and enforcement under review by Opus.
- Q9 restricted existing-Category/Uncategorized-only scope rejected: allow new Categories and Category Groups, and reorganizing already categorized Transactions. Split behavior and uncertain choices still open.
- Q10 accepted: chat approval with explicit agent trust and server-enforced allowed changes.
- Q11 not settled: owner asks about reversibility and why exclude special Transactions. Correct prior overbroad locked-Transaction claim: `saveTransaction` calls `requireLockKept`, which protects a Reconciled Transaction's amount/date/Account; it does not prohibit Category changes. Read verified at `convex/lib/transactions.ts:118` and `:196`.
- Q12 clarification requested using wait-what skill: explain concurrent edits with one Transaction and ask again.
- Q13 accepted: historical reclassification does not teach future Payee categorization.
- Q14 accepted: reviewable safe undo.

## Principles applied

- Experience First: begin with asking questions and reviewing concrete categorization proposals.
- Laziness Protocol: narrow the first release before choosing transports or extra capabilities.
- Boundary Discipline: distinguish owner session permissions from agent permissions.
- Separate Before Serializing Shared State: use an independent documentation worktree.
- Make Operations Idempotent: proposed writes will need retry and interruption semantics; not yet designed.

## Verification and remaining work

Ticket 01 is implemented on `feat/agent-access` (commits 2671de6, 066a3f8, af4f975 and the review-fix commit after them). Ticket 01's scope is the reads contract; where the Proposed architecture below lists more reads (Payees, Payee filter, caps on every read), ticket 01 supersedes it.

- **Automated:** `convex/agent.test.ts` drives the `/agent/*` routes through convex-test `t.fetch` (the agreed seam): the Agent Key admits and refuses, 400s for bad input and unknown or removed IDs, the dollar shapes, filters, and paging. Format, lint, both typechecks, and all 1004 tests pass.
- **Live, against a worktree-local anonymous backend:** setup (`--no-register`) wrote a 0600 key file; an MCP client listed the three tools and read the seeded October budget, Accounts, and Transactions; zod refused `limit: 500`; rotate made the old key 401; revoke made every key 401 and deleted the file. After review fixes: an ambient `CONVEX_DEPLOY_KEY` no longer redirects setup; rotate and revoke refuse when the checkout's deployment is not the one the key belongs to; a loose pre-existing key file comes back 0600 with no staged file left; a failed registration exits 1.
- **Not run:** `capacity:check` needs the main checkout's `.env.local`, which is missing until the restore thread finishes. Real setup on the owner's deployment and user-scope registration need the owner.
- **Review answers:** search results keep the shared reader's relevance order; the tool description says so. The budget and Accounts reads stay unpaged: they read what the owner's own budget screen reads. Interrupted rotation recovers by running rotate again; the config write is atomic, so the old config stays readable.
Ticket 02 is implemented on `feat/agent-access`; its Comments record the undo path deviation and the answer shapes.

- **Automated (ticket 02):** `convex/agentProposals.test.ts` drives `/agent/proposals` and `/agent/proposals/undo` through `t.fetch`: applying with every per-change outcome, split lines, new Categories and Groups with name clashes, a Reconciled Transaction, replay by proposal ID, undo that keeps the owner's later edits and keeps a created Category used by a Transaction, split line, Assignment, Target, or Remembered Category, the recent read, 401s, and 19 malformed-input 400s that each name their guard. Format, lint, both typechecks, codegen check, and all 1044 tests pass.
- **Live (ticket 02):** against the anonymous local backend, an MCP client listed the six tools with read-only and idempotent hints; applied a proposal that created a Group and a Category, applied one change, and reported `changed` and `startingBalance` for two others; the replay returned the same answer; a malformed proposal came back as a tool error; undo restored both changes, removed the created Category and Group, and a second undo returned the same answer; the recent read showed the proposal before and after undo.
- **Review answers (ticket 02):** a Category removed after the read is a per-change `notAllowed`, as the tool description says, not a whole-proposal 400; the ticket's wording was corrected. The 20-name cap on new Groups and Categories stays: the MCP schema already published it, and the tool now imports the server's limits instead of copying them.
- **Not run (ticket 02):** the `export/files` E2E journey, whose table inventory now includes `agentProposals`. It needs the Clerk development keys from the main checkout's `.env.local`, which is still missing; CI's E2E run covers it on the PR. The verify-budge feature map is unchanged: it maps web UI features, and its Export entry does not list tables.
- **Remaining:** shipping (PR, CI, CodeRabbit, merge, deploy).

### Integration correction analysis and PR follow-through

Sol ran the `correct` skill analysis-only against `git diff main...HEAD` at `42b3a29`. Opus decided each suggestion below; the accepted ones are in the commit after `42b3a29`.

- **Repeated class: guard tests that prove a rejection without identifying its cause.** `af4f975` distinguished removed Categories from malformed IDs; `c23ac30` strengthened malformed proposal cases with diagnostic assertions (`convex/agentProposals.test.ts:665-746`). The remaining read cases (`convex/agent.test.ts:331-355`) assert only 400 and nonempty text. Suggest Opus assess whether diagnostic fragments or valid peer cases would prove the HTTP boundary guards independently of downstream errors. Behavior tests are the appropriate enforcement level; a universal assertion-style rule would not prove the contract.
- **Repeated class: copied constraints across HTTP and MCP.** `c23ac30` replaced copied proposal caps with imports. The transaction cap still has two owners: `TRANSACTIONS_LIMIT` in `convex/lib/agentQuery.ts:7` and `.max(100)` in `scripts/agent/serve.ts:192`. Suggest sharing the existing constant; architectural ownership addresses this more directly than another synchronization test.
- **Additional observation, not an established recurring class:** split undo checks position and Category (`convex/agentProposals.ts:262-266`). A later owner split edit can replace the line at that position with one having the same Category. Opus should judge this against the accepted Category-only concurrency contract (Q12/Q20), without assuming stronger freshness is required.
- **Principles applied:** Boundary Discipline focused the analysis on validation at HTTP/MCP boundaries; Prove It Works prompted comparison of test assertions with the specific guard claimed; Laziness Protocol favors sharing the existing page-limit constant over adding synchronization machinery.
- **Opus decisions:** (1) accepted: every read refusal case in `convex/agent.test.ts` now names words from its own guard's message, as the proposal tests do. (2) accepted: the MCP tool takes the Transactions page cap from `TRANSACTIONS_LIMIT`. (3) kept as is: Q12/Q20 settled that a change counts as edited only when its Category changed; a later owner edit that leaves the same Category on the same split line position is, by that rule, not an edit, and undo restores it.
- **Correction review:** before `050fc57` the Transactions refusal table already listed a message fragment per case but asserted only `/\S/`, so the column was unused; the budget refusal table had no fragment. Each row now asserts its own guard's words. The MCP `limit` description still says "default 50" while `DEFAULT_TRANSACTIONS_LIMIT` stays private to `agentQuery.ts`; it is description text, not a copied validation rule, so it stays.
- **Verification (correction, `050fc57`):** mutation probe disabled the month, today, and limit guards in `convex/lib/agentQuery.ts`; all 7 matching refusal cases failed on their guard's missing words, then the file was restored. The pre-correction tests also failed under that probe, but on status or Convex's `options.numItems must be a positive number`, not on the guard. `codegen:check`, `format:check`, `lint`, `lint:ui`, `typecheck:app`, `typecheck:convex`, and `test` (61 files, 1044 tests) passed. `capacity:check` was not run (owner env missing), nor real owner-deployment setup or E2E; no web UI changed, so the three-judge UI review is exempt.

## Opus design review, pending owner decisions

Recommends conversational approval for the personal extension, explicitly trusting the agent to honor the owner's answer. A separate human gate is a different security guarantee; a server cannot infer that a human said yes from an agent apply call. No verified T3 native per-tool approval mechanism is established. Full-access agents that can reach other owner credentials are outside a scoped API's isolation guarantee; the review's hypotheses about ambient credential powers were not verified and must not be treated as proof that independent approval is useless.

Proposed guardrails: frozen exact-change proposals; server-side scope and current-state checks; replay-safe apply with recorded results; expiry/revocation; audited changes and safe undo. These are design recommendations, not accepted product decisions. Multi-batch atomicity, interruption recovery and freshness preconditions need concrete design and verification; expected old Category alone is not proof of complete freshness or safe partial retries.

Wider reclassification may shift historical Activity and later Available. Parent confirmed existing `requireUnlocked` and category memory calls in `convex/lib/transactions.ts`. Later verification corrected the review's overbroad lock claim: Reconciliation does not forbid Category-only changes; `requireLockKept` gates amount/date/Account changes. Open product decisions include special/split Transaction handling and conflict behavior. Chat trust, no Payee-memory side effects, and reviewable undo are accepted.

## Proposed architecture (Opus, pending confirmation)

- **Transport:** Convex HTTP actions under `/agent/*` on the deployment's site URL. Each request carries the Agent Key as `Authorization: Bearer`. The action compares the SHA-256 of the key with the fingerprint in the deployment env var `BUDGE_AGENT_KEY_SHA256` (constant-time), then calls internal queries/mutations. No `requireOwner` session reuse; the agent boundary is the HTTP layer.
- **Local adapter:** a stdio MCP server in this repo, run with Bun, that reads `{siteUrl, key}` from a 0600 file under `~/.config/budge/` and exposes named tools. One `bun run agent` command (`setup`, `rotate`, `revoke`) generates the key, sets the fingerprint on the chosen deployment (production by default) through the Convex CLI, writes the local file, and registers the server at user scope for Claude Code and Codex.
- **Reads (ticket 1):** month budget, Categories and Groups (including hidden flags), Accounts, Payees, and paginated Transactions filtered by month/date range, Account, Category, Uncategorized, Payee, and search. Every read has a page cap; Transactions reuse existing indexes and row enrichment.
- **Writes (ticket 2):** one apply call per Categorization Proposal, at most ~100 changes. Each change names a Transaction (or split line) with the Category the agent read and the Category it wants. A proposal may create Categories and Category Groups first (duplicate names refused, case-insensitive). The mutation applies matching changes through `lib/transactions.ts` operations, refuses changed, hidden-target, Transfer, and Starting Balance changes per item, leaves Remembered Categories and approval unchanged, and records the result in a new table. A client-supplied proposal ID makes retries return the recorded result.
- **Undo (ticket 2):** undo by recorded proposal; restores only Transactions still in the agent's Category; removes created Categories and Groups nothing uses.
