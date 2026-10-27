# Connect real accounts through the chosen aggregator and capture sample data

Type: task
Status: resolved
Blocked by: 01

## Question

Sign up for the aggregator chosen in ticket 01, connect the real Capital One and Discover accounts, and capture redacted sample payloads (accounts, pending and posted transactions) so the import flow and data model can be judged against real data. Record where credentials live (never in the repo).

Per ticket 01: apply for Plaid Trial first; check whether the Discover card has moved to a Capital One login before linking, and avoid creating duplicate Items (10 lifetime). Fall back to SimpleFIN Bridge if Plaid eligibility or linking fails.

## Comments

### Owner progress (2026-10-27)

- Owner confirmed the free Trial is active; Dashboard showed 0/10 connections used.
- Owner confirmed the Discover Credit Card Account appears under the Capital One sign-in. Start with one Capital One Bank Connection, then check which Accounts Plaid provides.
- Owner requested Sol exclusively for this ticket, including the setup wizard.
- Account-access wizard completed. Bank Connection and sample capture are still to do.
- Client ID and Production secret received through private input cards and stored in `~/budge-private/plaid/.env` (mode 0600); temporary input files removed. A Production institution lookup accepted the credentials without creating an Item.
- Plaid Quickstart installed in `~/budge-private/quickstart/`. Local changes bind the API to loopback, limit endpoints, suppress payload logs, save the access token and Item ID to `~/budge-private/plaid/capital-one-item.json`, and block another token exchange once one has started. A recovery marker preserves the public token if exchange needs diagnosis.
- Next manual step: run `.scratch/v1-spec/plaid-connect-wizard.sh` to check data-use settings and create one Capital One Bank Connection. The wizard has passed `bash -n`; its library matches the skill template. The interactive bank sign-in has not been run by the agent.

### Checklist for the owner (HITL)

Everything private lives outside the repo, in `~/budge-private/` (create it with `mkdir -p ~/budge-private/plaid && chmod 700 ~/budge-private`). Nothing from these steps goes into the repo, not even redacted samples.

1. **Check Discover first.** Sign in to discover.com. If it sends you to a Capital One login, the card has migrated: link it through Capital One. One Capital One Item may then cover checking, savings, and the card. Write down which case applies.
2. **Get Plaid Trial.** First try signing in to the developer Dashboard at dashboard.plaid.com; use password recovery if needed. Create an account only if you do not have one, and verify your email address. Open https://dashboard.plaid.com/trial-plan for the free Trial application. Complete the checks Plaid requests there. Do not use “Get Production access” / “Request access” under Production: that starts a paid-plan application. If Trial is unavailable, pending, or refused, stop and report that status; the fallback is SimpleFIN Bridge.
3. **Check OAuth access.** Trial includes OAuth access without full Production approval. If the Dashboard reports an institution-specific requirement or an access error, record the non-secret message and ask the agent before applying for paid Production access.
4. **Save credentials.** Put the Production `client_id` and secret in `~/budge-private/plaid/.env` (`PLAID_CLIENT_ID`, `PLAID_SECRET`), or in your password manager.
5. **Link with Plaid Quickstart, outside the repo.** `git clone https://github.com/plaid/quickstart ~/budge-private/quickstart`. Copy `.env.example` to `.env` and set `PLAID_ENV=production`, `PLAID_PRODUCTS=transactions`, `PLAID_COUNTRY_CODES=US`. Leave `PLAID_REDIRECT_URI` empty and use a desktop browser, where OAuth opens in a pop-up. Start the Node backend and the frontend, and link **once per login**. Each link uses up one of the 10 lifetime Items, so don't relink to retry.
6. **Save tokens.** Copy each `access_token` and `item_id` the quickstart shows into `~/budge-private/plaid/items.txt`.
7. **Capture raw payloads** for each access token:
   ```sh
   source ~/budge-private/plaid/.env
   for ep in accounts/get item/get; do
     curl -s https://production.plaid.com/$ep -H 'Content-Type: application/json' \
       -d "{\"client_id\":\"$PLAID_CLIENT_ID\",\"secret\":\"$PLAID_SECRET\",\"access_token\":\"$TOKEN\"}" \
       > ~/budge-private/plaid/$(echo $ep | tr / -)-$NAME.json
   done
   curl -s https://production.plaid.com/transactions/sync -H 'Content-Type: application/json' \
     -d "{\"client_id\":\"$PLAID_CLIENT_ID\",\"secret\":\"$PLAID_SECRET\",\"access_token\":\"$TOKEN\",\"count\":500}" \
     > ~/budge-private/plaid/transactions-sync-$NAME.json
   ```
   If `transactions_update_status` isn't `HISTORICAL_UPDATE_COMPLETE`, or `has_more` is true, wait a few minutes and run it again, passing `next_cursor` as `cursor`.
8. **Report back** without pasting raw data: which Items were made and for which logins, which Accounts each one has (type and subtype), how many added Transactions, whether any are `pending: true`, whether `merchant_name` is filled in on most rows, and how many Items you have left. The agent can then write a redaction script so samples can be shared safely.

## Answer

Completed on 2026-10-27 using the free Plaid Trial. One Capital One Bank Connection provides all three expected Accounts: checking and savings Cash Accounts (`depository/checking`, `depository/savings`), and the migrated Discover Credit Card Account (`credit/credit card`). The returned Credit Card Account name identifies Discover. No separate Discover Bank Connection was needed.

The first `/transactions/sync` capture returned 216 Transactions, with `transactions_update_status: HISTORICAL_UPDATE_COMPLETE` and `has_more: false`. None were pending. `merchant_name`, the preferred source for Payee, is populated for 148 of the 216; the other 68 require the Bank Text fallback in the import flow. No real pending sample is available from this capture, and none was fabricated.

The Dashboard initially showed 0/10 Trial Items used, and one Item was created in this session, so 9 should remain. The Dashboard count after creation was not independently rechecked.

All credentials, connection identifiers, and Account/Transaction payloads stay outside the repository:

- Credentials: `~/budge-private/plaid/.env`.
- Bank Connection token and Item ID: `~/budge-private/plaid/capital-one-item.json`.
- Raw captures: `accounts-get.json`, `item-get.json`, and `sync-*.json` under `~/budge-private/plaid/`.
- Sync checkpoint and summary: `capture-state.json` and `capture-summary.json` in that same directory.
- Structural samples: `~/budge-private/plaid/redacted-samples/`, generated by `~/budge-private/plaid/redact-samples.py`. Names, descriptions, IDs, dates, and numbers are replaced; tokens/cursors are removed. Nulls, booleans, array lengths, and selected enums are retained. These samples are synthetic in value and remain private.

Validation: Production credentials accepted; capture completed against the saved Bank Connection; structural sample JSON parses and does not contain API credentials or connection identifiers. Credential, token, and checkpoint file permissions were checked. The budget app import flow is not implemented by this setup task.

The numbered checklist above records the initial manual plan. The completed wizard instead saved the connection token automatically; there is no need to copy it or create another Bank Connection.

The two one-off setup wizards were archived in `~/budge-private/plaid/setup-wizards/` after completion. They are not a repeatable repository setup path.
