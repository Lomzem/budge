# Sign-in, owner authorization and shell

Admit the configured owner and preserve authenticated navigation while excluding signed-out and non-owner sessions.

## Sub-features

- `auth-login`, `auth-expired`, `auth-out`: authenticated storage, session loss and sign-out.
- `auth-owner`: single-owner gate for every public query/mutation/action.
- `auth-methods`: GitHub and email code real sign-in paths.

## How to get to it (user POV)

- Signed-out protected route → `/sign-in`; app Menu → Sign out.
- Direct `/`, `/categories`, `/accounts`, and `/accounts/<id>` after authentication.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Automated entry:** run app login, create a fresh context with printed storage state; navigate each protected route and require its heading and fixture data. At 320 px require View Budget instead of sidebar. A login command alone does not prove Convex owner access.
- **Signed out:** use a fresh context without storage state, navigate protected routes, require sign-in and no budget data. In authenticated context click visible Menu then menuitem Sign out; require sign-in, then reload protected route and require no data. Re-login before other feature checks.
- **Expired/non-owner:** when a separately authorized development identity or expired state is available, navigate protected pages and require access denied/sign-in without source data. For public API authorization enumerate queries/mutations/actions in the index, use the repo’s existing authorization tests; browser owner success alone is not rejection proof.
- **Real methods:** with authorized development GitHub/email identities, use visible Clerk GitHub or email-code controls on `/sign-in`, finish the real provider/code flow, require Budget and data. Record each method independently; backend-token app login does not verify them.

## Gotchas

- Never create Clerk users or request passwords/codes in chat. Existing CLI uses a backend sign-in token and existing invented CI identity; it does not exercise GitHub/email verification.
- No second identity or expired-session fixture is provided. Mark those paths blocked until available; production and 7-day real-device sessions are unverified.
- Sources: ticket 02, 23; `docs/agents/authentication.md`, `e2e/shell.test.ts`; public `owner.whoami` and all owner-guarded APIs.
