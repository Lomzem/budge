# Authentication

Budge supports GitHub and email verification codes through Clerk. Keep Email enabled in the development and production instances. The owner chose email support during setup because creating the CI test user with an email requires it. Passwords are not required.

Keep Clerk Invite-only. Production admits only the owner. Every public Convex function checks the Clerk user ID and issuer against `BUDGE_OWNER_SUBJECT` and `CLERK_JWT_ISSUER_DOMAIN`, regardless of the sign-in method. Use the owner's existing Clerk user for either method.

Local development, CI, and previews use the Clerk development instance. Create the CI test user once by hand, separately from the owner. Choose an invented email such as `budge-ci+clerk_test@example.com` and enter it when creating the user. Clerk does not generate this address. If the user already exists without an email, add the chosen address to its profile. Save that exact address as `E2E_CLERK_USER_EMAIL` and that user's ID as `E2E_CLERK_USER_ID` in GitHub Actions secrets.

CI uses `@clerk/testing` to sign in the existing test user through a backend sign-in token. It needs no mailbox, email verification code, or password. The test user is owner only on CI's temporary local Convex backend. Automated tests never create Clerk users or target production.

## Local E2E

Run `bun run test:e2e:local` from the main checkout or any worktree with `node_modules` installed. Arguments go to Playwright. It never asks for secrets. Do not run `bun run test:e2e` directly: the root `.env.local` points at the owner's dev backend.

The runner copies the checkout to a temp directory and starts a fresh anonymous Convex backend there. It sets the test user as owner, seeds it with `seed:run`, runs the suite serially, then stops the backend and deletes the copy. A failed run keeps the copy for its logs.

It passes only `PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`, `E2E_CLERK_USER_ID`, and `E2E_CLERK_USER_EMAIL`. Each comes from the environment, else from the main checkout's `.env.local`. It refuses non-development Clerk keys, an issuer from another Clerk instance, a backend that is not anonymous and local, and a busy port 4173. It redacts these values and Clerk session tokens from the output.
