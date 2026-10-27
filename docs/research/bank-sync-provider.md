# Bank sync provider for Budge

Researched **2026-10-27**. Scope: one person's US Capital One checking/savings accounts and Discover credit card; private deployment of the public `Lomzem/budge` codebase; **$25/year maximum for aggregation**, excluding app hosting. No live financial accounts were connected for this research.

## Recommendation

**Use Plaid's new free Trial plan, if eligible; keep SimpleFIN Bridge ($15/year plus tax) as the fallback.** Plaid now explicitly describes Trial as suitable for hobbyists, includes Transactions and OAuth, and lists both banks in its official coverage export. This is a meaningful change from advice about its former Limited Production tier. SimpleFIN also lists both institutions and offers a straightforward consumer subscription. Neither coverage list guarantees that this particular Discover card will connect during its migration to Capital One. [Plaid billing](https://plaid.com/docs/account/billing/), [Plaid coverage CSV](https://plaid.com/documents/us_institution_coverage.csv), [SimpleFIN pricing](https://beta-bridge.simplefin.org/), [SimpleFIN institution search](https://beta-bridge.simplefin.org/search-institutions).

First establish whether the card still uses Discover's login or has moved to Capital One. Start with sandbox data, then validate both actual connections before relying on sync. If Plaid eligibility, its lifetime Item cap, or migration problems prevent use, try one month of SimpleFIN before buying the annual plan. **Plan for posted transactions and occasional user-assisted reconnection.** Capital One does not provide pending transactions through Plaid and requires annual consent renewal. [Discover's migration notice](https://www.discover.com/credit-cards/card-smarts/more-to-discover/), [Plaid Capital One notes](https://plaid.com/docs/link/oauth/#capital-one).

## Shortlist and budget

“Listed” below means first-party coverage evidence, not an authenticated test of the user's accounts. “Unverified” means insufficient evidence, rather than proof of no support.

| Provider / route | Annual aggregator cost for this use | Capital One / Discover evidence | Decision |
| --- | --- | --- | --- |
| **Plaid Trial** | **$0**, up to 10 Items created in total | Both have Transactions in the official coverage CSV | **Recommended**, subject to new-team eligibility and actual linking |
| **SimpleFIN Bridge, through MX** | **$15 + tax**, or $18 + tax for 12 monthly payments; 25 institutions and 25 apps | Public search returns `Capital One` and `Discover Credit Card` | **Fallback**, subject to actual linking and checkout total |
| Teller Development | $0, 100 enrollments created in total | Current public catalog lists `CapitalOne`; no Discover match | Conditional candidate after migration, not established for both accounts |
| MX direct | Free developer keys; ongoing production price unverified | OAuth institutions require production registration | No established route meeting all requirements |
| Akoya direct | Free sandbox; Standard production dollar price unpublished on pricing page | Provider/product coverage available through its Hub | No established route within $25/year |
| Finicity / Mastercard Open Finance US | Test Drive is free; real customers require a paid plan, price unverified | Live institution/product coverage not verified here | No established route within $25/year |
| Yodlee | Some official guides advertise free Launch; current eligibility, limits, and ongoing terms unverified | Bank-specific access on that tier not verified | Investigate only if shortlist fails |
| Sophtron | Indexed developer agreement offers free personal use; current page retrieval is inconsistent | Capital One logo shown; Discover transaction coverage unverified | Possible lead, insufficient evidence to recommend |
| Lunch Flow | **$34.99/year**, two connections included | Coverage does not change the price exclusion | Above budget |

Sources for the first two rows: [Plaid billing](https://plaid.com/docs/account/billing/), [coverage export](https://plaid.com/documents/us_institution_coverage.csv), [SimpleFIN pricing](https://beta-bridge.simplefin.org/), [institution search](https://beta-bridge.simplefin.org/search-institutions). Other rows are documented below. Tax is not assumed to be zero; confirm SimpleFIN's total remains under $25.

## Capital One's acquisition changed the connection decision

Capital One completed the acquisition on **May 18, 2025**. That corporate event did not move every Discover login immediately. Discover's July 6, 2026 notice says some cardholders already manage their cards through Capital One while others will follow. Do not infer the right connector from the card's branding or payment network. [Acquisition announcement](https://investor.capitalone.com/news-releases/news-release-details/capital-one-completes-acquisition-discover), [Discover cardholder notice](https://www.discover.com/credit-cards/card-smarts/more-to-discover/).

For Budge, this means:

- A card still serviced through Discover needs a working Discover connector.
- A migrated card needs to be exposed through the Capital One connection and included in the user's account selections. Whether an existing connection automatically discovers it must be checked.
- A new provider connection or bank migration can change external identifiers. Treat matching the migrated card to its existing Budge account as a separate reconciliation step; do not assume old transaction IDs survive.

These are integration conclusions from the bank's migration notice and its permission model, not a claim that any provider has completed every migration. Capital One allows users to authorize specified data and accounts, revoke continuous access, and notes some accounts/data may be ineligible. [Capital One data-sharing terms](https://www.capitalone.com/digital/datasharing-terms-conditions/).

## Plaid Trial: viable and recommended

### Cost, limits, and personal-use fit

Trial is available for new US/Canadian teams created on or after **April 15, 2026**. It is free, includes Transactions and Transactions Refresh, and permits **10 Production Items created over the account's lifetime**. Deleting an Item does not restore capacity. One institution login can include multiple accounts, so the anticipated starting usage is two Items, or possibly one after migration if everything shares a login. Avoid creating duplicates. No elapsed-time expiry is stated in the cited plan documentation; this is not a promise the plan will exist forever. Paid pricing must be checked before any upgrade. [Billing and Trial limits](https://plaid.com/docs/account/billing/).

The Trial help article requires US/Canadian residence and no existing Production or Limited Production account. Business registration and the full security questionnaire are not required, but the application includes identity verification, the MSA, and security attestations. Most applications are automatically approved; approval is not guaranteed. API calls against existing Items have no Trial usage cap. A paid upgrade cannot be reversed back to Trial. This is an expressly offered route for a personal project, not an attempt to use consumer access as developer access. [Trial eligibility and agreements](https://support.plaid.com/hc/en-us/articles/39994173227159-What-is-the-Plaid-Trial-plan).

Private deployment of Budge is consistent with the documented hobbyist purpose, subject to the accepted MSA and Developer Policy. The latter requires accurate registration, secure credentials, encryption, and protection of financial data. Public source code does not authorize publishing account data, credentials, or access tokens. The actual onboarding MSA was not available to inspect without applying; this report does not replace that agreement. [Developer Policy](https://plaid.com/legal/#developer-policy).

### Coverage and authorization

The official US coverage CSV, generated **2026-10-16T03:26:16.866Z**, has:

| Institution | Plaid institution ID | Transactions | Balance | Liabilities |
| --- | --- | --- | --- | --- |
| Capital One | `ins_128026` | Yes | Yes | Yes |
| Discover | `ins_33` | Yes | Yes | Yes |

These are the exact entries downloaded on the research date. Plaid warns its public coverage explorer is not real-time; `/institutions/get` or the Dashboard is the current check. The list establishes advertised support, not availability for a specific migrated card. [Official CSV](https://plaid.com/documents/us_institution_coverage.csv), [coverage caveat](https://plaid.com/docs/institutions/).

Use Plaid Link to capture consent, then exchange its temporary public token server-side for the Item's access token. Capital One uses bank-hosted OAuth; Trial has access to OAuth institutions without the full paid-plan registration process. Discover's exact current login flow and consent lifetime were not established by the public coverage CSV. Let Link route authorization and inspect the actual result rather than hard-coding a Discover OAuth or credential assumption. [Link OAuth guide](https://plaid.com/docs/link/oauth/), [Trial OAuth coverage](https://support.plaid.com/hc/en-us/articles/39994173227159-What-is-the-Plaid-Trial-plan).

**Capital One consent lasts one year** before refresh. Use Link update mode for renewal or `ITEM_LOGIN_REQUIRED`; inspect `consent_expiration_time` and handle `PENDING_DISCONNECT` notices. Access-token storage and bank consent are separate: retaining a token does not prevent consent expiry or revocation. Credit cards with past-due payments cannot be linked. Refresh is unsupported for Capital One Items containing only non-depository accounts; automatic transaction updates remain the intended path. [Institution-specific OAuth behavior](https://plaid.com/docs/link/oauth/#capital-one).

### Transactions, de-duplication, and freshness

- **Data/history:** checking, savings, and credit-card transactions; dates, amount, description, merchant/category and other enrichment where available. Initial history defaults to 90 days and can request up to 730; actual bank availability still governs. Request the desired depth at initial linking. Stored history grows while the Item remains connected. [Transactions overview](https://plaid.com/docs/transactions/).
- **Pending:** supported generally where the institution supplies it, but **Capital One supplies none**. Do not promise pending Discover transactions after migration. Capital One can also redact descriptions, reducing enrichment quality. [Capital One notes](https://plaid.com/docs/link/oauth/#capital-one).
- **IDs:** use case-sensitive `transaction_id` and apply `/transactions/sync`'s added, modified, and removed records. Persist the sync cursor. IDs support repeat-sync de-duplication within a connection; do not treat them as cross-provider identifiers. [Transactions API](https://plaid.com/docs/api/products/transactions/).
- **Pending becoming posted:** Plaid removes the pending record and adds a posted record with a different ID; `pending_transaction_id` links them when matched. Even posted records can change or disappear. [Transaction-state semantics](https://plaid.com/docs/transactions/transactions-data/).
- **Delivery:** Plaid generally checks banks one to four times daily. `SYNC_UPDATES_AVAILABLE` notifies Budge to fetch changes; polling `/transactions/sync` also reads available changes. Calling sync alone is not an instruction to poll the bank immediately. Initialize sync at least once to enable that webhook. [Refresh frequency](https://plaid.com/docs/transactions/), [webhook and sync API](https://plaid.com/docs/api/products/transactions/).
- **Sandbox:** free mock accounts, OAuth testing, dynamic pending/posted transitions, and triggered webhooks are available. Sandbox success does not prove live bank connectivity. [Sandbox docs](https://plaid.com/docs/sandbox/).

The recommendation assumes staying within Trial. Older marketing language about 200 free Limited Production calls is not the governing offer for a newly eligible team: Plaid explicitly distinguishes the two. [Current environment comparison](https://support.plaid.com/hc/en-us/articles/16110110883479-How-are-Sandbox-Production-Trial-plan-and-Limited-Production-different).

## SimpleFIN Bridge: viable fallback

### Cost, coverage, and terms

Bridge costs **$15/year plus tax** or **$1.50/month plus tax**, allowing 25 institutions and 25 apps. This is a consumer-paid bridge to financial apps; no commercial company or separate MX contract is described for a personal subscriber. [Pricing](https://beta-bridge.simplefin.org/).

On **2026-10-27**, public institution searches for `Capital One` and `Discover` returned **`Capital One`**, **`Discover Credit Card`**, and separately **`Discover Bank Account`**. Those exact names matter: a bank-account listing alone would not prove card coverage. The search is an HTML POST form, so the evidence is reproducible by submitting those names at the linked page; there is no durable results URL. It exposes institution names, not account-level status or guaranteed history. [Official institution search](https://beta-bridge.simplefin.org/search-institutions).

SimpleFIN identifies **MX** as its connectivity provider. Its terms permit use through the published interface and impose API usage limits; no prohibition on a privately deployed personal application was found in those terms. Use the Bridge subscription and API, rather than assuming the subscription grants direct MX developer access. [Privacy policy](https://beta-bridge.simplefin.org/info/privacy), [Terms of Use](https://beta-bridge.simplefin.org/info/terms).

### Authorization and duration

Connect the banks in Bridge, create a Setup Token for Budge, and claim it once for a reusable, revocable Access URL. Budge stores that URL privately; bank credentials go through MX. [Developer guide](https://beta-bridge.simplefin.org/info/developers), [security policy](https://beta-bridge.simplefin.org/info/security).

**Bridge publishes no fixed bank-consent or re-auth interval, or Access URL expiry**, in the cited documentation. MX and the institution govern the upstream authorization. Plaid's annual rule is not a verified Bridge guarantee. Display authentication errors and direct the user back to Bridge for repair. [Developer guide](https://beta-bridge.simplefin.org/info/developers), [protocol authentication errors](https://www.simplefin.org/protocol.html).

### Transactions and operating limits

- **Data:** balances, amount, description, posted timestamp, optional transaction timestamp, and optional pending flag. Pending transactions require `pending=1` and upstream support; they are excluded by default. Neither institution's pending coverage is guaranteed by Bridge's public search. [Protocol](https://www.simplefin.org/protocol.html).
- **History:** requests may span at most **90 days each**; this is a request-window limit, not a promise of only 90 days of total history. Initial history differs by institution. MX retains fetched account/transaction data indefinitely according to Bridge's privacy policy; deletion removes associated MX data within two weeks. [Developer limits](https://beta-bridge.simplefin.org/info/developers), [retention policy](https://beta-bridge.simplefin.org/info/privacy).
- **IDs:** transaction IDs are unique within an account and must not be reused there. Scope de-duplication to provider connection, account, and transaction ID. No explicit guarantee of identical pending/posted IDs or continuity after rebuilding a connection was found. [Protocol](https://www.simplefin.org/protocol.html).
- **Polling:** daily updates; **24 or fewer requests/day** expected. General and account-filtered queries have separate quotas; excess use can disable access. No transaction webhook is documented. Overlap fetch windows by about five days. More API calls do not guarantee fresher upstream data. [Developer guide](https://beta-bridge.simplefin.org/info/developers).
- **Sandbox:** demo token for sample-data claim/fetch; no full institution/MFA simulator documented. [Demo flow](https://beta-bridge.simplefin.org/info/developers).

The remaining uncertainty is account-level service quality during Discover migration. Verify that both intended accounts return posted transactions before annual purchase. If the card has moved, use the Capital One connection that actually exposes it rather than repeatedly rebuilding the legacy Discover connection.

## Teller: cheap, but conditional coverage and terms

Teller advertises free use for independent developers, with **100 live connections**. Its environment guide clarifies that Development's cap is **100 enrollments ever created**, not active accounts; deletion does not restore it. One enrollment is a bank login with potentially several accounts. Production requires business verification. The published Transactions production rate is $0.30/enrollment/month: two enrollments would be $7.20/year for that product alone, but this is not evidence a personal developer can obtain Production or that no other fees apply. [Pricing](https://teller.io/), [environments](https://teller.io/docs/guides/environments/).

**Coverage evidence:** the official website's [institution catalog](https://teller.io/data/institutions.json), fetched over verified HTTPS on the research date, contains 7,008 entries and a snapshot timestamp of **2026-10-22**. It lists `CapitalOne` / `capital_one`; no institution name or ID contains `discover`. The catalog does not include product capability flags. The documented live [institutions API](https://teller.io/docs/api/institutions/) was unreachable from this research environment. Therefore Capital One membership is evidenced, but neither the precise deposit-account coverage nor migrated Discover-card coverage was validated. Absence from this cached catalog is not proof of permanent non-support.

If the card has migrated, Teller could become a useful free candidate, but confirm that both deposits and that card expose Transactions. Its generic account model includes checking/savings and credit cards; that alone does not establish bank-specific coverage. [Account types](https://teller.io/docs/api/accounts/).

Technical characteristics if coverage is confirmed:

- Teller Connect returns an enrollment access token. Real-data calls require **mTLS client certificate/private key plus the access token**. No universal bank re-auth lifetime is published; disconnections can require fresh credentials/MFA. Repair through Connect using the existing `enrollmentId`, preserving its token. [Authentication](https://teller.io/docs/api/authentication/), [repair flow](https://teller.io/docs/guides/connect/).
- Transactions have pending/posted status, amount, date, description and enrichment. IDs are stable ordinarily; a substantially changed pending charge can produce a new posted ID. Poll with a 7–10-day overlap and upsert by ID. No fixed initial history depth or bank-specific pending guarantee was established. [Transactions](https://teller.io/docs/api/account/transactions/).
- `transactions.processed` webhooks accompany upstream refreshes, with at least one polling attempt per 24 hours; `enrollment.disconnected` indicates repair needs. [Webhooks](https://teller.io/docs/api/webhooks/).
- Free sandbox simulates authorization, MFA and disconnects. [Sandbox](https://teller.io/docs/guides/sandbox/).

**Terms caveat:** the Developer Terms allow building apps, but also describe the Platform license as for internal business purposes. That wording and the Development-versus-Production distinction make indefinite operation of a deployed personal budget less explicit than the marketing's free independent-developer offer. Obtain clarification if selecting Teller for ongoing use; do not treat the free cap as an unconditional personal-production license. [Developer Terms, sections 3 and 5](https://teller.io/legal/developer/terms/). Together with incomplete coverage evidence, this keeps Teller behind the two recommendations.

## Other providers investigated

| Provider | First-party evidence and reason it is not a confirmed solution |
| --- | --- |
| **MX direct** | [Developer keys are free](https://docs.mx.com/resources/client-dashboard/manage-api-keys), but [OAuth registration requires production access](https://docs.mx.com/resources/oauth-guide/); unregistered OAuth institutions do not appear in institution responses. The [API-access page](https://www.mx.com/api-access/) routes onboarding through its team and gives no personal annual price. A free development key does not establish free Capital One access. Coverage, contract, and a ≤$25 production price remain unverified; SimpleFIN supplies an evidenced consumer route to MX instead. |
| **Akoya** | [Standard is for fewer than 10,000 monthly connections](https://akoya.com/pricing); no Standard dollar price or permanent free live allowance is stated, and setup fees may apply. Free sandbox uses test data. [Recipients must pass security/risk review](https://akoya.com/datasharing), and [provider/product details are in the Hub](https://docs.akoya.com/akoya/guides/hub-manual-data-providers). No confirmed personal-use price or public evidence covering both intended accounts was established. Do not interpret the 10,000-connection breakpoint as free usage. |
| **Finicity / Mastercard Open Finance US** | Mastercard's [official Postman workspace](https://www.postman.com/mastercard/mastercard-open-finance/overview) distinguishes free Test Drive/test institutions from a paid plan for live customers. The [current quickstart](https://developer.mastercard.com/open-finance-us/documentation/quick-start-guide/) is a sandbox workflow. No published personal live tier at ≤$25/year was found; production price, bank coverage, and personal licensing remain unverified. This is a budget-evidence exclusion, not a claim of unsupported banks. |
| **Yodlee** | The official [Account Verification Quickstart](https://av.developer.yodlee.com/) still advertises a free Launch tier. Its [FAQ](https://developer.yodlee.com/resources/yodlee/faqs/docs/building_testing) says Sandbox cannot link live sites and directs live users to Launch/sales. However, this research could not establish current Launch enrollment, transaction limits, OAuth availability for both banks, or indefinite personal-use terms; the attempted developer pricing URL returned 404. [Current aggregation getting-started docs](https://developer.yodlee.com/products/yodlee/account-aggregation/docs) establish free sample-data Sandbox only. Retain as an unresolved possibility, not a proven $0 live solution. |
| **Sophtron** | A search-indexed first-party [Developer Agreement](https://sophtron.com/developerAgreement), dated October 26, 2025, explicitly grants free personal, non-commercial API access. But direct retrieval of that URL and [pricing](https://sophtron.com/pricing) currently serves general landing content rather than those terms or a price schedule; the [docs landing page](https://docs.sophtron.com/) did not expose enough information. The current site shows Capital One branding but no verified Discover transaction coverage, quotas, consent duration, ID semantics, or sandbox details. Promising personal-use lead; current terms and both-bank connectivity need confirmation before considering it viable. |
| **Lunch Flow** | Its [current individual pricing](https://www.lunchflow.app/) is $34.99 annually with two connections included, already above the cap. A seven-day trial or older promotional price cannot satisfy an ongoing $25/year requirement. |

For excluded or unresolved options, filling in re-auth, history and webhook guarantees would give false precision: no affordable, permitted live route covering both accounts was established first. No provider was contacted, no paid plan was accepted, and no private institution API requiring credentials was used.

## Implications for the eventual integration

These are recommendations for later implementation, not application changes made by this research:

1. Start with Plaid Trial eligibility and a sandbox integration. Preserve real Items; renew consent through update mode rather than spending the finite cap on delete/recreate cycles.
2. Keep Budge's account identity separate from provider account IDs. Require explicit reconciliation when a Discover card migrates or a provider changes; matching only amount/date can merge legitimate repeated purchases.
3. Treat imported data as mutable. Apply change/removal records, handle pending-to-posted replacement, retain sync state, and expose last-successful-sync time and reconnection needs.
4. Keep credentials and financial payloads server-side in private deployment storage. Use authenticated, owner-only operations; keep production tokens, Access URLs, mTLS keys, logs, exports and real transaction fixtures out of the public repository. Public examples should use synthetic data only.
5. Before relying on either provider, validate both intended accounts, posted transactions, repeat-import de-duplication, available history and migration behavior with the owner present. Public institution lists cannot answer those account-specific questions.

The supported, affordable shortlist is **Plaid Trial and SimpleFIN Bridge**. The unresolved items above are deliberately labeled so future work can revisit them without mistaking stale pricing, free sandbox access, or an institution logo for confirmed live support.
