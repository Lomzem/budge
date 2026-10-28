# Authentication

Budge supports GitHub and email verification codes through Clerk. Keep Email enabled in the development and production instances. The owner chose email support during setup because creating the CI test user with an email requires it. Passwords are not required.

Keep Clerk Invite-only. Production admits only the owner. Every public Convex function checks the Clerk user ID and issuer against `BUDGE_OWNER_SUBJECT` and `CLERK_JWT_ISSUER_DOMAIN`, regardless of the sign-in method. Use the owner's existing Clerk user for either method.

Local development, CI, and previews use the Clerk development instance. Create the CI test user once by hand, separately from the owner. Choose an invented email such as `budge-ci+clerk_test@example.com` and enter it when creating the user. Clerk does not generate this address. If the user already exists without an email, add the chosen address to its profile. Save that exact address as `E2E_CLERK_USER_EMAIL` and that user's ID as `E2E_CLERK_USER_ID` in GitHub Actions secrets.

CI uses `@clerk/testing` to sign in the existing test user through a backend sign-in token. It needs no mailbox, email verification code, or password. The test user is owner only on CI's temporary local Convex backend. Automated tests never create Clerk users or target production.
