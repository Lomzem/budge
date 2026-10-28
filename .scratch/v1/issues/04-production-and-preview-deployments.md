# 04: Production and preview deployments

**What to build:** Budge is live at `budge.lomzem.dev`. It uses production Convex and a Clerk production instance where only I can sign in with GitHub or an email verification code. Every pull request gets a preview of its own on a Convex preview deployment, loaded with the synthetic seed and protected by Vercel Authentication. All of it stays within the free tiers. Most steps are dashboard, DNS, and OAuth work only the owner can do: the agent writes a `wizard` script for them, and the owner runs it.

**Blocked by:** 03 (Manual Accounts and Transactions)

**Status:** ready-for-human

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 2, 4, 130–131, 133, 135–136; Environments, deployment, and free-tier limits

- [x] The Vercel project is linked to the repo, and its Git integration deploys previews and production. Production builds with `npx convex deploy --cmd 'bun run build'` and the production `CONVEX_DEPLOY_KEY`. SSR runs on the Node runtime.
- [ ] Clerk production instance on `budge.lomzem.dev`. Its DNS records (Frontend API, Account Portal, email/DKIM) and Vercel's record are added in Cloudflare as DNS-only. The owner's own GitHub OAuth app points its callback at Clerk. GitHub and email verification code sign-in, with Email enabled. Invite-only, with only the owner's verified email invited.
- [x] Production Convex env holds `BUDGE_OWNER_SUBJECT`, `CLERK_JWT_ISSUER_DOMAIN`, `BUDGE_TOKEN_KEY`, the production flag, and Plaid Trial credentials. Vercel Production env holds the production Convex URL and Clerk production keys.
- [x] The Vercel Preview environment holds a Convex preview deploy key and Clerk development keys, and the build uses `--preview-run` to load `seed:run`. Convex default preview env vars are set for the Clerk dev instance, Plaid Sandbox, and a throwaway `BUDGE_TOKEN_KEY`. Vercel Authentication protects preview URLs.
- [ ] A Vercel Ignored Build Step skips the build (and so the Convex preview deployment) when a push changes only `.scratch/**`, `docs/**`, or Markdown files. One docs-only push proves it.
- [x] The cloud dev deployment exists only for Plaid Sandbox webhooks and real-iPhone checks, and has a daily function-call usage limit that pauses it.
- [x] The README notes where to check Convex team usage and Vercel usage. One preview's I/O and storage are checked against the free tier after it deploys.
- [ ] Production signs in as the same Clerk owner user with GitHub and email verification codes. A second user is refused through either method.

## Comments

### Setup preparation, 2026-10-28

The owner approved this sequence. The local, one-run wizard splits
the seven groups into 15 terminal screens.

1. Confirm Convex Free and Vercel Hobby. Record the public Convex project URL.
2. Configure Clerk Production, its DNS records, GitHub OAuth, and the owner.
   Record the production issuer and owner ID, plus the Development issuer and
   owner ID. Enter the GitHub OAuth secret directly in Clerk.
3. Set Convex production variables and default Preview variables. Record the
   public production Convex URL. Put Plaid credentials and separate token keys
   directly in the appropriate dashboards. Leave `BUDGE_PRODUCTION` absent
   outside production. Stop if the existing Plaid Trial credentials are unavailable.
4. Link Vercel to `Lomzem/budge`. Record the public Vercel project URL. Put the
   production deploy key and Clerk live keys in Production. Put the preview deploy
   key and Clerk test keys in Preview. GitHub Actions needs no new secrets.
5. Set the build command, Standard Protection, and the docs-only skip rule.
   Add the Vercel DNS record in Cloudflare as DNS-only. Confirm the production
   target before deploying `main` through Vercel.
6. Record the cloud dev dashboard URL and set a daily function-call disable
   threshold. The wizard suggests 1000 calls. The owner chooses the actual limit.
7. Check production sign-in by hand. Check one preview, its expiration and usage,
   and one docs-only push. Record the public preview URL and measured I/O and storage.

The untracked helper is `.scratch/v1/deployment-wizard.sh` in the owner checkout.
Run it from an interactive terminal. It is not a repeatable setup script committed
to this repository. The
wizard stores only public values and confirmations in ignored
`.env.deployments.local`. It leaves `.env.local` unchanged. Secrets go directly
into the provider dashboards and the owner's password manager. The script does
not run cloud commands, automated sign-in checks, Git writes, or deployment commands.

The shared build command is:

```sh
npx convex deploy --cmd 'bun run build' --cmd-url-env-var-name PUBLIC_CONVEX_URL --preview-run seed:run
```

The environment-scoped deploy key selects production or a branch preview. The
explicit URL option supplies the correct `PUBLIC_CONVEX_URL` during the build.
The installed Convex 1.48.0 CLI runs `--preview-run` only for a new preview,
as checked in `node_modules/convex/src/cli/deploy.ts`. Repeated pushes to the
same preview do not need a change to `seed:run`.

Convex Free previews expire after five days by default. Check the actual preview
expiration in its dashboard. No cleanup workflow is needed for that default.
The current seed creates synthetic Accounts and Transactions. The tokenless
Bank Connection and the bank sync code arrive in later tickets.

The Ignored Build Step compares the previous successful deployment with `HEAD`.
It skips changes limited to `.scratch/**`, `docs/**`, and Markdown files.
If the previous commit is unavailable in Vercel's shallow clone, it builds.
Canceled builds still count toward Vercel deployment quotas and concurrent build
slots. The skip rule saves full build work and avoids Convex preview creation.
It does not preserve the Vercel deployment-count allowance stated in the spec.

Verification of the prepared files passed Bash syntax checking, wizard library
comparison, stage count, public-state checks, and isolated checks of the ignored
build command. ShellCheck is not installed. No dashboard setup or live deployment
check has run. The deployment checklist remains open. README now explains where
to check Convex and Vercel usage.

Before closing this ticket, record the production deployment link, preview link,
owner sign-in results, refusal results for an uninvited identity, the cloud dev
limit, preview expiration, measured I/O and storage with units and time windows,
and the docs-only push result. Do not record credentials or financial data.

Sources checked on 2026-10-28:

- [Convex on Vercel](https://docs.convex.dev/production/hosting/vercel)
- [Convex preview expiration](https://docs.convex.dev/production/multiple-deployments)
- [Convex usage limits](https://docs.convex.dev/production/usage-limits)
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Vercel project settings](https://vercel.com/docs/project-configuration/project-settings)
- [Vercel Ignored Build Step](https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel)
- [Clerk production setup](https://clerk.com/docs/guides/development/deployment/production)
- [Clerk GitHub OAuth](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/github)
- [Clerk access mode](https://clerk.com/docs/guides/secure/restricting-access)

### Browser setup in progress, 2026-10-28

The owner requested browser operation instead of running the wizard. Existing
GitHub sign-in provided access to Convex, Clerk, Vercel, and Cloudflare.

- Created the Clerk production instance, cloned from the Invite-only Development
  instance. Production instance ID is `ins_3LKrsAi9IwQGvnulXXAxthRWaPR` under
  app `app_3LIk0flxSb9SMx5gSOESSvxnxV4`. Clerk uses `lomzem.dev` as its primary
  domain. The production Frontend API is `https://clerk.lomzem.dev`.
- Created Vercel project `lawjay-lees-projects/budge`, linked to `Lomzem/budge`
  on Hobby. Project ID is `prj_XDXCv15q8jjAiHxCBGRC35So9wf5`. No deployment yet.
  Added `budge.lomzem.dev` as its Production domain.
- Created Convex production deployment `scrupulous-fox-38` in US East under
  team `lawjaylee1`, project slug `budge`. URL is
  `https://scrupulous-fox-38.convex.cloud`. Left the older `budge-488ea` project
  unchanged. No application code deployed yet.
- Imported six CNAME records into Cloudflare for `lomzem.dev`, all DNS-only.
  The names are `clerk`, `accounts`, `clkmail`, `clk._domainkey`,
  `clk2._domainkey`, and `budge`. Targets came directly from Clerk and Vercel.
- Saved Vercel's shared Convex build command and `bun install --frozen-lockfile`.
- Convex Free team usage is already over its data egress allowance for October,
  at 1.6 GB of 1 GB. Database I/O is 475.66 MB of 1 GB. No paid upgrade selected.

Remaining work includes DNS verification and certificates, GitHub OAuth, the
production owner, deployment variables and keys, build skipping, preview
protection, the cloud dev limit, deployments, and the manual checks. Continue
from the actual dashboard state. Do not treat this progress note as completion.


### Browser handoff, 2026-10-28

- Clerk verified all five DNS records. Certificates began issuing. Its production
  instance is Invite-only. Email verification codes are enabled. The cloned
  settings also enable email sign-in links, which still need to be disabled to
  restrict sign-in to the requested methods. Password settings remain to be checked.
- The GitHub OAuth app is [Budge production](https://github.com/settings/applications/3972895).
  Its homepage is `https://budge.lomzem.dev`, and its exact callback is
  `https://clerk.lomzem.dev/v1/oauth_callback`. Client ID is
  `Ov23li1yAT5QUqEz5O7q`. The ID was entered into Clerk's connection form but is
  not yet saved with a secret. GitHub requires owner reauthentication before
  generating the secret. The shared browser's GitHub tab remains at Confirm access.
- Clerk's Production Invitations page confirms exactly one pending invitation,
  for the owner's existing verified iCloud email. The owner must accept and
  verify it before the production owner ID can be recorded. No production owner
  ID is set in Convex yet. Do not send another invitation. A second form submission
  reported an error, but the Invitations page confirms the first succeeded.
- Vercel saved the shared build command, frozen Bun install, and the custom
  Ignored Build Step. Its Node version is 24.x. Standard Protection with Vercel
  Authentication is enabled, and system environment variable exposure is enabled.
- Vercel Production now has `PUBLIC_CONVEX_URL` and
  `PUBLIC_CLERK_PUBLISHABLE_KEY`, both stored as Config values. Secret keys and
  the Preview variables are not set. Clerk's copy control and the browser
  clipboard transferred the publishable key without printing its value.
- Convex production `scrupulous-fox-38` now has `BUDGE_PRODUCTION=true` and
  `CLERK_JWT_ISSUER_DOMAIN=https://clerk.lomzem.dev`.
- Convex Preview defaults now have owner the development owner ID in ignored local state
  and issuer `https://vocal-goldfish-7280.clerk.accounts.dev`. No production flag
  is set in the Preview defaults. Plaid and token-key defaults remain unset.
- Created cloud dev reference `lawjaylee1:budge:dev/webhooks`, deployment name
  `trustworthy-falcon-764`, URL `https://trustworthy-falcon-764.convex.cloud`.
  Its Development owner and issuer match the Preview defaults. An active daily
  Function calls disable limit of 1000 was set and verified with the CLI.
  No application code is deployed there. Local deployment selection was not changed.
- Convex's deployment and project settings pages stopped rendering their main
  content in the browser. The authenticated Convex 1.48.0 CLI completed the public
  variable writes and the cloud dev limit with explicit deployment targets.
  Browser automation also returned "No preview automation host is available for
  press". DOM reads and form submissions continued to work. Use actual provider
  state on resumption rather than relying on a stale dialog or draft.

The owner has two pending authentication steps: GitHub Confirm access, and the
Clerk invitation acceptance with email verification. After those steps, finish
OAuth and Clerk API secrets, set the production owner, create and scope Convex
deploy keys in Vercel, and set the reserved Plaid and token variables without
printing credentials. Then verify certificates and the Vercel domain, deploy
production and one PR preview, and perform the remaining manual checks. No
application deployment, live sign-in check, preview usage measurement, or
docs-only skip proof has run. The team egress overage remains unresolved.

### OAuth configured and invitation resent, 2026-10-28

The owner confirmed GitHub access. Generated the OAuth client secret and copied
it directly through the browser clipboard into Clerk's production GitHub
connection. Saved the connection and verified that the SSO connections page now
shows GitHub as "Used for sign-in" instead of "Setup required". Cleared the
browser clipboard afterward. No secret value was printed or saved in the repo.

At the owner's request, used Clerk's Reinvite user action for the same iCloud
email. Clerk confirmed "User reinvited successfully." The Invitations page shows
new and original pending invitations, dated 12:23 PM and 12:13 PM respectively.
Both links remain valid. These are two invitations for the same owner email,
not invitations for two people. The owner still needs to accept and verify one.

### Invitation accepted and deploy keys saved, 2026-10-28

The owner accepted the newer Clerk invitation. Confirmed the production user
the production owner ID in ignored local state, with the owner's iCloud email and the GitHub
account linked to that same user. The original invitation can still appear as
Pending, so a pending invitation alone does not prove acceptance failed. Set
this user ID as `BUDGE_OWNER_SUBJECT` on production `scrupulous-fox-38`.
Clerk's user profile reports Password as a disabled field.

The owner's screenshot showed a connection error after Clerk redirected to
`budge.lomzem.dev`. Acceptance succeeded before the redirect. The app has not
had a successful deployment yet.

Created these keys through the official Convex Management API with the existing
CLI authentication. Saved each as Secret `CONVEX_DEPLOY_KEY` in Vercel:

- `vercel-budge-production-2026-10-28` targets `scrupulous-fox-38`, allows only
  `deployment:deploy`, and is scoped to Vercel Production only.
- `vercel-budge-preview-2026-10-28` targets project `3304592`, team
  `lawjaylee1`, slug `budge`, and is scoped to Vercel Preview only.

Vercel initially refused Secret values until a first deployment existed. Used
Deployments, Actions, Create Deployment to start an initial build of `main`,
commit `e5c98dd`. It started before either deploy key was added. After that,
Vercel accepted both Secret values. This initial build was for project
initialization. It is not evidence that the app or backend deployed successfully.

Transferred the keys through private files in a temporary directory outside the
repo, with directory mode 700 and file mode 600. Vercel confirmed both saves.
Deleted both files and their directory. No secret value was printed.

Clerk now requires dashboard email verification before creating the server API
key named `Budge Vercel production`. The shared Clerk tab is at Verification
required. Asked the owner to enter the emailed code only on Clerk and continue.
No new Clerk API key has been created yet. Do not create a duplicate key after
verification without checking the current modal and key list.

Remaining work: finish that key and store it as Production `CLERK_SECRET_KEY`,
set the Clerk Development keys in Vercel Preview, finish the reserved Plaid and
token variables, disable production email sign-in links, verify certificates
and domain status, rerun production with the configured credentials, and prove
a PR preview and docs-only skipping. Keep the checklist open until those live
checks pass. No automated test has targeted a cloud deployment.

Official API references used:

- [Create deploy key](https://docs.convex.dev/management-api/create-deploy-key)
- [Create preview deploy key](https://docs.convex.dev/management-api/create-preview-deploy-key)


### Production ready and Sandbox configured, 2026-10-28

Vercel Production deployment `3AhUVv8qZBUenke37CruGYFtRcSG` reached Ready in
34 seconds. The owner completed the Vercel verification required to start it.
The site is reachable at `https://budge.lomzem.dev` with valid TLS.

Saved the newly created Clerk server key in Vercel Production. Saved the existing
Clerk Development publishable and server keys in Vercel Preview only. Both
Convex deploy keys remain in their matching Vercel scopes. Removed the private
transfer files after confirming the saves. No secret value entered tool output.

The initial GitHub sign-in reached Clerk but the backend refused it. A read-only
check confirmed that the subject and issuer matched, but the session token lacked
an audience. Activated Clerk's Convex integration explicitly on Production.
The refreshed session token has audience `convex`, and the owner now reaches the
empty Budget screen. No application code changed for this fix. No real Accounts,
Transactions, or Plaid Items were created. The local wizard and README now explain
the per-instance integration requirement.

Disabled production email sign-in links and verified the saved setting after a
reload. Email verification code sign-in remains enabled, and passwords are
disabled. GitHub is the only social provider.

Saved the existing private Plaid production credentials in production Convex.
After the owner signed in to Plaid, verified that its Client ID matches the
private configuration and saved its Sandbox credentials only in Preview defaults
and cloud dev. Made no Plaid API calls and created no Items. Deleted the private
Sandbox transfer file and cleared the browser clipboard.

Set independent random 256-bit `BUDGE_TOKEN_KEY` values on production, Preview
defaults, and cloud dev. They are standard Base64 encodings of 32 random bytes.
Existing keys are retained on reruns. These values are reserved for the later
TokenCipher implementation. No encryption code exists in this ticket.

Only public deployment configuration and owner IDs are saved in ignored
`.env.deployments.local`. The task record omits the owner's email and user IDs
because the repository is public.

Remaining proof: a protected, seeded PR preview, its actual expiration and usage,
a docs-only skipped build, and the owner's email-code and uninvited-user sign-in
checks. The team data egress overage still prevents claiming that all shared
usage is within the Free allowance.

### PR preview and SSR fix, 2026-10-28

Opened draft PR https://github.com/Lomzem/budge/pull/3. Its first Vercel preview
reached Ready in 31 seconds and created Convex preview `enchanted-kudu-640`,
reference `preview/04-production-and-preview-deployments`. Creation was
2026-10-28 20:02:21 UTC; expiration is 2026-11-02 20:02:21 UTC, five days later.
The anonymous browser was redirected to Vercel login before it could reach Budge.

Measured the synthetic preview through a preview-only export and the installed
Convex SDK's `getDocumentSize`, including system fields. It contains 117 documents
and 21,318 bytes of document payload: 3 Accounts, 93 Transactions, 11 Payees,
9 monthly totals, and 1 settings document. Deleted the export after measuring it.
This is document payload size, not a claim about the billing dashboard's total.
The deployment usage API reported 0.00007723364979028702 GB database I/O for the
current UTC day and calendar month after seeding and the measurement. Its
`seedStatus` was `partial`, so ingestion may revise that counter. These are small
relative to the shared 0.5 GB database-storage and 1 GB monthly I/O allowances.
The team's previously recorded data-egress overage is a separate unresolved limit.

The first preview returned 500 after GitHub sign-in. Runtime logs reported a
second `cache-control` assignment from the root layout. Opus reproduced it
locally and found the underlying error that it masked: Preview gets its Convex
URL only during the build, while the app read it from the runtime environment.

Opus's fix reads the Convex URL from static public build configuration and moves
private/no-store header assignment to the finished response in the outer hook.
It preserves the original render error instead of masking it when SvelteKit
reruns the root layout to render an error page. CI's checks job gets an explicit
localhost URL for environment type generation. There is no application fallback.
Four local SSR tests cover signed-in and sign-in responses, the error path, and
a built app running without the Convex URL at request time. The old code failed
the relevant regressions. The fixed code passed all 78 tests, formatting, both
linters, and both typechecks, including a clean checkout with CI's environment.
No automated test contacted a cloud backend.

This fix is ready to push and verify in the PR preview. The docs-only skipped
build and the owner's remaining manual access checks are still pending.

### Repaired preview verified, 2026-10-28

Commit `6d22b2f` deployed successfully as Vercel deployment
`FrFSFTmwWJuN9QyVVZnrES3UcM5f`:
https://budge-b1y61dt2y-lawjay-lees-projects.vercel.app.
The owner signed in with GitHub and reached the seeded Budget screen with
Checking, Savings, and Card accounts. A same-origin page request returned HTTP
200 and `Cache-Control: private, no-store`. The existing Convex branch preview
was reused. Production was not seeded.

All deterministic CI checks passed on this commit: application checks, browser
E2E, secret scanning, and Vercel deployment. CodeRabbit has not reviewed it;
the PR remains a draft while the docs-only skip proof is prepared.

This documentation-only commit is the test push for the Ignored Build Step.
Its result must be checked in Vercel before that checklist item is closed.

The first docs-only test, `b3c076f`, built in 24 seconds instead of skipping.
Vercel still had Automatic selected: the earlier save had not persisted. Attempted to save
the Custom ignored-build command, but the dashboard rejected its length.
The follow-up test also ran before the correction was saved.
After the owner preview visit, the usage API reported 7 function calls and
0.00007895566523075104 GB database I/O for the current UTC day and month;
`seedStatus` remained `partial`.

The dashboard enforces a 256-character limit on the ignored-build command.
The original command exceeded it. Replaced the shell `if` wrapper with an AND/OR
chain that preserves the same build-on-missing-base behavior in 226 characters.
Reloaded the dashboard, expanded Project Settings, and confirmed Custom plus
the exact 226-character command persisted. This docs-only push tests that rule.
