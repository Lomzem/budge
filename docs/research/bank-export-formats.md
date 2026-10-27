# Capital One and Discover website transaction exports

Research date: **2026-10-27**. Scope: US personal Capital One checking and savings at capitalone.com, and Discover credit cards at discover.com, including cards moving to Capital One. Public-source research; no authenticated bank session or private customer export was used. All examples below are invented.

## Summary

- **Capital One deposit accounts:** CSV is well supported by documented export walkthroughs. Quicken's live institution directory also advertises **Web Connect for Capital One 360**, and an open-source checking-account QFX fixture contains OFX transaction IDs. Separate `.ofx`, `.qbo`, and `.qif` menu choices are less certain; do not promise every format for every US checking/savings product. [Keeper walkthrough, secondary][keeper]; [Intuit directory, primary for Quicken support][directory]; [QFX fixture, historical implementation evidence][c1-fixture].
- **Discover cards still on discover.com:** the best-supported download choices are **CSV, Excel-labelled `.xls`, and PDF**. An open-source importer establishes the five-column CSV layout and inverted card signs. Native OFX/QFX downloads are absent from the historical download menu and current Quicken directory; no reliable evidence establishes a current native QBO option. [Discover converter and captured menu, historical implementation evidence][discover-converter]; [CSV importer source][discover-csv]; [Intuit directory][directory]; [2026 walkthrough, secondary][discover-guide].
- **Date limits remain partly unverified:** Capital One officially documents two years of visible deposit-account activity and seven years of statements, which does **not** guarantee a two-year file export. Discover has an older official 24-month viewing FAQ, also **not** an export guarantee. Public sources disagree on export limits; neither bank publishes a current, complete public export specification covering maximum span, oldest date, and every format. [Capital One history][c1-history]; [Capital One statements][c1-statements]; [Discover legacy FAQ][discover-history]; [range conflicts below](#date-ranges-what-is-established).
- **De-duplication:** neither documented CSV layout includes a bank transaction ID. Native OFX-family files can carry `FITID`; preserve it and scope it to institution/account. Presence of an ID in one file does not prove stability across repeated downloads or migration. [CSV layouts][c1-layout]; [Discover importer][discover-csv]; [OFX specification §3.2.3][ofx-202].
- **The acquisition now affects access:** the deal closed May 18, 2025; cards are migrating in waves during 2026 and into 2027. After an individual account moves, it can no longer be managed on discover.com; use Capital One's website/app. The banks do not document export-schema or transaction-ID continuity across that move. [Acquisition announcement][acquisition]; [2026 transition guide][transition]; [account-access FAQ][migration-faq].

## Evidence and confidence

**Bank primary** means the institution's own documentation. **Software primary** means a specification, software publisher's directory, or inspected source code: authoritative about that artifact, but not a guarantee of today's bank UI. **Secondary** means a walkthrough, forum, or commercial converter guide. Historical artifacts are explicitly dated; merely finding an old page live today does not make its content current.

Research could verify public documentation and code, not the signed-in download menus for this user's accounts. Consequently, **unverified does not mean unavailable**. The unresolved details are identified below rather than replaced with an assumed universal limit.

## Website format availability

| Website/account | CSV | OFX / QFX | QBO / QIF | Other |
| --- | --- | --- | --- | --- |
| Capital One 360 checking | Documented in secondary walkthroughs, including a checking-account screenshot. | **QFX supported by strong evidence:** current Intuit directory lists `BANKING&WEB-CONNECT`; a 2023 QFX fixture confirms actual structure. Separate `.ofx` choice is reported, not bank-verified. | Current US consumer choices **unverified**. Older QIF instructions and conflicting QBO claims are insufficient for a universal yes/no. | PDF statements; “CSV (Spreadsheet, Excel, Numbers)” is a CSV label, not evidence of native XLS/XLSX. |
| Capital One 360 savings | CSV reported alongside checking; six-field deposit-account layout reported. | Same Capital One 360 directory entry; importer explicitly covers checking and savings, but the inspected fixture is checking only. Separate `.ofx` choice remains unverified. | Same uncertainty as checking. | PDF statements. |
| Other/legacy Capital One checking and savings | CSV reported; verify product-specific menu. | Do not generalize 360 support: Intuit's separate `Capital One Bank - New` entry lists aggregation without Web Connect. | Unverified. | PDF statements. |
| Discover credit card **still serviced at discover.com** | Supported by importer code and 2026 secondary walkthroughs. | Best evidence indicates **native OFX/QFX no longer offered**; Intuit lists aggregation, not Web Connect. Historical OFX importers prove past support only. | No reliable current native QBO evidence; QIF not established. Treat either as unavailable for planning until observed. | Excel-labelled `.xls` and PDF appear in the 2022 captured menu; 2026 secondary guidance still reports Excel/PDF. Native XLSX is not established. |
| Discover credit card **already moved to Capital One** | Inspect the new account's menu; legacy Discover CSV availability/schema is not guaranteed. | Capital One card services have their own directory entry; deposit-account formats cannot establish this card's menu. | Unverified for migrated cards. | Managed through Capital One; do not send this user back to Discover's transaction page. |

Sources: [Keeper, updated April 9, 2025, including checking screenshots — secondary][keeper]; [deposit CSV layout — secondary][c1-layout]; [Intuit live directory — software primary][directory]; [Capital One importer][c1-importer] and [2023 fixture][c1-fixture]; [Discover CSV importer][discover-csv]; [2022 download menu][discover-menu]; [2026 Discover guide — secondary][discover-guide]; [Capital One migration FAQ — bank primary][migration-faq].

The directory was fetched on the research date. Relevant observed entries were Capital One 360 (`01236`, Web Connect banking), Capital One Bank - New (`17410`, aggregation), Capital One Card Services (`07492`, Web Connect credit), and Discover Card (`07101`, aggregation only). This is evidence of **Quicken connection support**, not proof that a particular signed-in bank account exposes every corresponding extension. [Intuit directory][directory]; [Quicken's explanation of Web Connect][web-connect].

Avoid two common source substitutions: Capital One **Canada's** help page explicitly lists CSV, QIF, QFX, QBO and OFX, but it does not establish US deposit-account support; Capital One **Intellix** documents commercial export formats, which likewise do not establish personal-account choices. [Canada help][canada]; [Intellix guide][intellix].

## CSV layouts and synthetic examples

### Capital One checking and savings

A documented deposit-account layout is:

```csv
Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance
DEMO-CHECKING,"Debit Card Purchase - EXAMPLE CAFE",10/20/26,Debit,12.50,987.50
DEMO-CHECKING,Deposit from EXAMPLE PAYROLL,10/21/26,Credit,1000.00,1987.50
DEMO-SAVINGS,Interest payment,10/22/26,Credit,2.00,502.00
```

**Secondary evidence:** the six-column layout and positive magnitudes with `Debit`/`Credit` direction are described by a converter and independently supported by a January 2025 walkthrough's formulas. For this layout, budgeting amount = `-Transaction Amount` for debit and `+Transaction Amount` for credit. Account labels and values above are synthetic, not a promise about real account-number masking. [Layout and signs][c1-layout]; [walkthrough][c1-walkthrough].

**Historical software evidence:** a 2021 checking-CSV project documents the same fields in a different order: account number, transaction date, transaction amount, transaction type, transaction description, balance. Its actual parser selects **negative** amounts as expenses and parses `%m/%d/%y`, establishing a signed-amount variant. Match by header rather than position, and inspect both amount sign and transaction type. For explicit `Debit`/`Credit` rows, normalize their magnitude in the indicated direction; blindly negating an already-negative debit would turn spending into income. [Pinned project README][c1-csv-code]; [parser source][c1-csv-parser].

This layout has one date column, a transaction description, and a running balance, but **no separate transaction ID or posting-date column**. A balance is not a transaction ID. Its single date's exact bank semantics are not publicly specified. Two-digit-year examples appear in secondary evidence; do not silently guess century or day/month order for unfamiliar variants. [Layout][c1-layout].

Capital One **credit-card** CSVs are a separate profile, relevant if a Discover card adopts that export after migration:

```csv
Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2026-10-20,2026-10-21,0000,EXAMPLE CAFE,Dining,12.50,
2026-10-22,2026-10-22,0000,EXAMPLE PAYMENT,Payment/Credit,,50.00
```

Here budgeting amount is credit minus debit. This is a **secondary-documented Capital One card example**, not a verified migrated-Discover schema and not the checking/savings layout. [Card layout][c1-layout].

### Discover credit card on discover.com

```csv
Trans. Date,Post Date,Description,Amount,Category
10/20/2026,10/21/2026,EXAMPLE CAFE,12.50,Restaurants
10/22/2026,10/23/2026,EXAMPLE PAYMENT,-50.00,Payments and Credits
10/23/2026,10/24/2026,EXAMPLE REFUND,-5.00,Merchandise
```

**Software primary:** the inspected Discover CSV importer matches these exact headers, parses `%m/%d/%Y`, and multiplies amounts by `-1`. Thus purchases are positive in the bank CSV; payments/refunds are negative. Normalize to budgeting signs by negating once. Keep both transaction and posting dates; the period chosen in the UI need not imply filtering by transaction date. [Pinned importer source][discover-csv]; [2026 explanation, secondary][discover-columns].

The five-field schema contains **no bank transaction ID, account identifier, pending flag, or running balance**. Select the destination account explicitly; don't infer identity from the filename alone. Description should remain merchant text; Discover's category is a bank classification, not necessarily a Budge category. These are implications of the schema, not extra exported fields. [Importer source][discover-csv].

The Excel-labelled export historically used **HTML tables inside an `.xls` file**, not a binary Excel workbook. A synthetic structural illustration is:

```html
<table><tr><td>Recent activity — synthetic example</td></tr></table>
<table>
  <tr><th>Trans. Date</th><th>Post Date</th><th>Description</th><th>Amount</th><th>Category</th></tr>
  <tr><td>10/20/2026</td><td>10/21/2026</td><td>EXAMPLE CAFE</td><td>12.50</td><td>Restaurants</td></tr>
</table>
```

The 2022 converter parses the second HTML table and its date/description/amount cells. This establishes a historical quirk, not today's exact HTML wrapper. Inspect content before choosing an XLS parser. [Converter source][discover-converter].

## Date ranges: what is established

| Account/route | Selection and reach supported by evidence | What remains unknown |
| --- | --- | --- |
| Capital One checking/savings activity export | A checking screenshot shows **Custom Date Range**, with start/end inputs. A 2021 checking-CSV project reports two previous years. | Current earliest exportable date, maximum span per file, row cap, and whether limits differ among CSV/QFX/OFX/QBO. |
| Capital One activity view and statements | Bank help explicitly says **past two years** of website activity, and **up to seven years** of statements for active accounts with paperless access. | Those figures do not establish a matching machine-readable download window. |
| Discover card still on legacy website | Secondary instructions describe statement-period or date-range selection. An older official mobile FAQ refers desktop users to **up to 24 months of viewed transactions**. | Current CSV/XLS maximum lookback, custom-range bounds, row cap, date-filter semantics and endpoint inclusivity. No defensible universal export cap found. |
| Migrated Discover card | Account access moves to Capital One when that account is ready. | Whether legacy statement/activity export history, dates and file formats transfer unchanged. |

Sources: [Keeper screenshot — secondary][keeper]; [2021 checking project — historical][c1-csv-code]; [Capital One history][c1-history]; [Capital One statements][c1-statements]; [Discover walkthrough — secondary][discover-guide]; [legacy Discover FAQ][discover-history]; [migration FAQ][migration-faq].

**Conflicting secondary claims:** recent converter guides claim a 90-day Capital One export ceiling, while the older checking project reports two years. Discover guides variously claim approximately 12 months, 18 months of OFX, or no CSV at all. Some contradict their own pages. None supersedes an observed account menu; these numbers are **not verified bank limits**. In particular, a bank-feed initial-sync limit is not automatically a website-export limit. [Capital One 90-day claim][range-conflict]; [Discover 12-month claim][discover-range-conflict]; [Discover 18-month OFX claim][discover-ofx-conflict]; [Discover PDF-only claim][discover-pdf-conflict].

PDFs are an archival route, not a machine-readable equivalent of CSV/OFX. Capital One notes that inactive savings accounts may receive quarterly statements and direct accounts can share a statement; do not assume one PDF per account per month. [Bank statement help][c1-statements].

## OFX-family structure, signs and transaction IDs

OFX is structured data, not a column layout. A **synthetic, abbreviated posted-transaction fragment** for checking is shown below; it omits the full response/header, account and balance wrappers. The inspected Capital One fixture has the bank statement response, account identifiers, transaction list and ledger balance, and carries `MEMO` rather than `NAME` on its transaction records. [Fixture][c1-fixture].

```xml
<STMTTRN>
  <TRNTYPE>DEBIT</TRNTYPE>
  <DTPOSTED>20261021000000</DTPOSTED>
  <TRNAMT>-12.50</TRNAMT>
  <FITID>DEMO-CHECKING-POSTED-001</FITID>
  <MEMO>EXAMPLE CAFE</MEMO>
</STMTTRN>
```

For savings, the account wrapper uses `ACCTTYPE=SAVINGS` instead of `CHECKING`; an interest credit might have `TRNTYPE=INT` and `TRNAMT=2.00`. Credit-card OFX uses `CCSTMTRS`/`CCACCTFROM`; a purchase has negative `TRNAMT`, while a payment is positive. **Do not apply Discover CSV sign inversion to OFX.** These are standard structures, not proof Discover currently offers such a download. [OFX 2.0.2 §§11.3–11.4.3, bank-hosted specification][ofx-202].

`FITID` is assigned by the financial institution/service provider to identify a statement transaction. Use institution + account + FITID, never FITID alone. The Capital One checking fixture has a FITID on each of its four posted records, but there was no repeated-export experiment to verify stability. Preserve IDs as opaque strings. [OFX §3.2.3][ofx-23]; [fixture][c1-fixture].

OFX also supports corrections through `CORRECTFITID` and `CORRECTACTION` (`REPLACE`/`DELETE`); a repeated identifier and changed content deserves review. Dates may carry times/offsets; `DTPOSTED` and optional `DTUSER` have different meanings. [OFX 2.0.2 §11.4.3][ofx-202].

QFX uses OFX structure with Quicken-specific extensions; the Capital One fixture, for example, includes `INTU.BID`. The extension alone is insufficient to choose SGML versus XML parsing. QBO is the QuickBooks Web Connect variant; support for importing it elsewhere does not establish bank export availability. [ofxtools README][ofxtools]; [fixture][c1-fixture]; [Intuit supported upload types][intuit-formats].

For Discover CSV/XLS, generated OFX files cannot recover missing bank IDs. The inspected 2022 converter emits **no FITID**, hard-codes `TRNTYPE=DEBIT`, and uses the first date cell as `DTPOSTED`. It is useful format evidence, not a production-quality conversion to adopt unchanged. Discover's older native OFX importer likewise proves historical compatibility, not current availability. [Converter source][discover-converter]; [legacy Discover OFX importer][discover-ofx-code].

## Pending versus posted

- **Capital One bank primary:** pending debit-card authorizations affect available balance, can change, may disappear, and can take up to five days to post. That help page does not specify export behavior. **Secondary** guidance says CSV downloads typically contain posted transactions only. Treat this as expected behavior to verify for the actual deposit account. [Bank pending help][c1-pending]; [CSV guidance, secondary][c1-export-pending].
- **Discover bank primary:** pending is distinct from an applied account transaction. **Secondary** 2026 export guidance describes posted CSV activity and excludes pending. The CSV schema itself has no status field. A 2021 automation script contains an `includePend=Y` request parameter; that is historical code, not evidence that today's CSV contains pending rows. Do not promise universal exclusion solely from the column names. [Discover pending help][discover-pending]; [secondary CSV guide][discover-columns]; [historical script][discover-old-request].
- **OFX primary specification:** `STMTTRN` is for posted transactions in `BANKTRANLIST`; pending uses `STMTTRNP` in `BANKTRANLISTP`. A parser accepting OFX does not necessarily implement pending records; do not flatten them into posted entries. Neither bank's current website use of the pending aggregate was established. [OFX 2.2 §11.4.4][ofx-22].

Practical implication for Budge: treat verified posted activity as the import baseline, preserve pending separately if encountered, and reconcile a later posted row rather than counting an authorization twice. This is a recommendation, not a bank guarantee. Quicken documents a past Discover duplicate-download issue, reinforcing that a feed's apparent identifiers should not be assumed perfect. [Quicken support, March 27, 2024 — primary for its product issue][discover-duplicates].

## What the acquisition changed

Capital One completed the Discover acquisition on **May 18, 2025**, retaining Discover-branded card products. Its July 2026 transition guide says some cardholders have moved and others will move later in 2026 or 2027. There is no single migration date for every Discover cardholder. [Acquisition announcement][acquisition]; [transition guide][transition].

The bank's access FAQ explicitly says migrated accounts disappear from management on discover.com/the Discover app. Unmigrated accounts remain accessible there; multiple accounts can move separately. Existing Capital One customers can link the moved account, while other cases may require new credentials. Temporary feature restrictions occur before migration. None of this establishes an export-format or FITID mapping contract. [Migration FAQ][migration-faq].

The loss of Discover native OFX-family exports **predates** the acquisition: the converter and its CSV/Excel/PDF menu capture date to November 2022. Current Discover-hosted connectivity instructions describe Express Web Connect, not a manually downloaded website file. Therefore, attributing all missing OFX/QFX downloads to the 2025 acquisition would be unsupported. [Historical converter/menu][discover-converter]; [Discover-hosted connectivity instructions][discover-connectivity].

For Budge, associate old and new imports with the same user-selected budgeting account, while preserving source provenance. **Do not assume** the unchanged physical card/account number implies unchanged export headers, transaction IDs, history depth or date formatting. Account and card continuity are documented; export continuity is not. [Capital One consumer-card information][consumer-card].

## Open-source parsers and useful quirks

| Project | Useful evidence/capability | Limitations to check |
| --- | --- | --- |
| [ofxtools][ofxtools] (Python) | Reads OFX 1 SGML and OFX 2 XML; QFX support; typed fields. | README targets OFX 1.6/2.03 and ignores proprietary Intuit tags. Its inspected `STMTTRN` model requires FITID; do not assume newer pending aggregates work. [Model source][ofxtools-model]. |
| [ofxparse][ofxparse] (Python, MIT) | Bank, credit-card and investment parsing; exposes transaction ID, amount, dates and memo. | Check error reporting/encoding and the actual file variant with synthetic fixtures before adoption. |
| [Red's importers][reds] (Python) | Direct evidence for Discover CSV headers/date format/sign inversion and Capital One checking/savings OFX support. | Historical source compatibility does not certify the bank UI today. Its Capital One filename pattern references checking, so savings filename recognition needs verification. [Capital One adapter][c1-importer]. |
| [YNAB Discover converter][discover-converter] (PHP, Unlicense) | Demonstrates HTML disguised as XLS and the legacy download menu. | Historical, not a new bank format; missing IDs and fixed transaction type noted above. |

Research-based recommendations, not implementation changes: accept CSV and an OFX-family parser first; map CSV by headers; use decimal/cents arithmetic; preserve both card dates and raw descriptions; and show a preview of normalized signs before importing. For CSV without IDs, date/amount/description matching is only a heuristic: identical legitimate purchases can collide. Compare overlapping imports with multiplicity and allow review, especially when switching file formats or migrating accounts. A converter-generated ID is not the original bank's FITID.

## Remaining verification

Before treating these profiles as exact contracts, inspect each relevant account's actual download menu and privately test: available extensions; oldest selectable date and maximum span per format; date endpoint behavior; a pending authorization versus its posted replacement; and two overlapping native downloads for stable FITIDs. For migrated Discover cards, also compare old/new headers and overlapping historical rows. These are unresolved observations, not reasons to assume no export exists. Only synthetic fixtures should enter this public repository.

## Source register

All sources were consulted on 2026-10-27. Dates below are publication/update or artifact dates where available. Code links are pinned to inspected revisions. Bank documentation, Intuit's directory and parser code are primary for their respective claims; secondary export guidance is explicitly identified throughout.

- Capital One bank primary: [transaction history][c1-history]; [online statements][c1-statements]; [pending debit-card transactions][c1-pending].
- Acquisition/access bank primary: [May 18, 2025 completion][acquisition]; [July 9, 2026 transition guide][transition]; [migration FAQ][migration-faq]; [consumer-card overview][consumer-card]; [Discover-hosted software connectivity PDF][discover-connectivity].
- Discover bank primary: [legacy mobile transactions FAQ][discover-history] (undated/old UI; viewing only); [pending-transaction article][discover-pending] (February 20, 2026).
- Software primary: [live Intuit directory][directory] (downloaded successfully as text; web reader could not decode it); [Web Connect definition][web-connect]; [Intuit upload formats][intuit-formats]; [Quicken Discover duplication notice][discover-duplicates].
- Standards: [OFX 2.0.2, full PDF hosted by Scotiabank][ofx-202]; [FDX OFX 2.2][ofx-22] and [2.3][ofx-23]. The FDX links returned fetch errors/access denial during this research; relevant 2.2/2.3 passages were available in indexed search extracts. The full 2.0.2 PDF was retrieved and inspected. Newer pending-aggregate claims rely on the indexed 2.2 text, not the older PDF.
- Historical software artifacts: [Capital One checking README, April 2021][c1-csv-code]; [Capital One QFX fixture, added May 9, 2023][c1-fixture]; [Discover CSV adapter][discover-csv]; [Discover XLS converter/menu, November 2022][discover-converter]; [2021 Discover request code][discover-old-request].
- Secondary: [Keeper export walkthrough, updated April 9, 2025][keeper]; [Excel Checkbook walkthrough, January 5, 2025][c1-walkthrough]; [useme4 column layouts][c1-layout]; [Discover walkthrough][discover-guide]; [BankXLSX Discover columns, updated August 21, 2026][discover-columns]; [MindsBudget pending/export guidance][c1-export-pending]. Conflicting commercial claims are linked where discussed and are not treated as authoritative.

[c1-history]: https://www.capitalone.com/help-center/checking-savings/transaction-history/
[c1-statements]: https://www.capitalone.com/help-center/checking-savings/online-statements/
[c1-pending]: https://www.capitalone.com/help-center/checking-savings/pending-transactions/
[acquisition]: https://investor.capitalone.com/news-releases/news-release-details/capital-one-completes-acquisition-discover
[transition]: https://www.capitalone.com/learn-grow/money-management/more-to-discover/
[migration-faq]: https://www.capitalone.com/updates/discover/card-faqs/
[consumer-card]: https://www.capitalone.com/updates/discover/consumer-card/
[discover-history]: https://www.discovercard.com/mobile/data/footer/faq_txn.html
[discover-pending]: https://www.discover.com/credit-cards/card-smarts/how-stop-pending-transaction/
[discover-connectivity]: https://www.discover.com/applications/help-center/assets/Discover-Bank-and-Credit-Card-Connectivity.pdf
[directory]: https://ofx-prod-filist.intuit.com/qw2800/data/fidir.txt
[web-connect]: https://www.quicken.com/support/web-connect-troubleshooting/
[intuit-formats]: https://plugin-qbo.intuit.com/qbo-ush/helpcontent/production/124/en_US/QBO_Plus/Content/Topics/banking/help_banking_webconnect_faq.htm
[ofx-202]: https://www1.scotiaconnect.scotiabank.com/help/secured/en_US/Official_OFX_File_Specification_v202.pdf
[ofx-22]: https://financialdataexchange.org/common/Uploaded%20files/OFX%20files/OFX%202.2.pdf
[ofx-23]: https://www.financialdataexchange.org/common/Uploaded%20files/OFX%20files/OFX%20Banking%20Specification%20v2.3.pdf
[keeper]: https://www.keepertax.com/posts/how-to-export-capital-one-bank-statements-as-a-spreadsheet-csv
[c1-layout]: https://useme4.com/capital-one-csv-to-quickbooks/
[c1-walkthrough]: https://excel-checkbook.com/exporting-transactions-from-a-capital-one-bank-account-to-import-load-into-the-excel-checkbook-register/
[c1-csv-code]: https://github.com/wgwz/capital-one-recurring-expenses/blob/208d95f8ee84b6a020424ca99a0f77205b416fbc/README.md
[c1-csv-parser]: https://github.com/wgwz/capital-one-recurring-expenses/blob/208d95f8ee84b6a020424ca99a0f77205b416fbc/app/parse.py
[c1-importer]: https://github.com/redstreet/beancount_reds_importers/blob/c0e89235048318ce125c110629d7345ece14d177/beancount_reds_importers/importers/capitalonebank/__init__.py
[c1-fixture]: https://github.com/redstreet/beancount_reds_importers/blob/c0e89235048318ce125c110629d7345ece14d177/beancount_reds_importers/importers/capitalonebank/tests/360Checking.qfx
[discover-csv]: https://github.com/redstreet/beancount_reds_importers/blob/c0e89235048318ce125c110629d7345ece14d177/beancount_reds_importers/importers/discover/__init__.py
[discover-ofx-code]: https://github.com/redstreet/beancount_reds_importers/blob/c0e89235048318ce125c110629d7345ece14d177/beancount_reds_importers/importers/discover/discover_ofx.py
[discover-converter]: https://github.com/IridescentShadow/ynab-discover-converter/blob/f6b314d775ad2a51238d9dec12fdc84dea118749/index.php
[discover-menu]: https://github.com/IridescentShadow/ynab-discover-converter/blob/f6b314d775ad2a51238d9dec12fdc84dea118749/images/download_options.png
[discover-old-request]: https://github.com/fallalex/beancount-discover/blob/f58e47fedb3b32f6ca89316dacf31096c48fe98a/src/discover-transactions.py
[discover-guide]: https://www.insytesbi.com/guides/discover/
[discover-columns]: https://bankxlsx.com/blog/can-i-export-discover-card-transactions-to-csv-or-excel
[range-conflict]: https://capyparse.com/blog/how-to-download-bank-statements-as-csv
[discover-range-conflict]: https://capyparse.com/blog/how-to-download-bank-statements-as-csv
[discover-ofx-conflict]: https://easystatementsheet.com/blog/export-discover-statement-to-excel/
[discover-pdf-conflict]: https://www.creditcardtoexcel.com/blog/credit-cards-that-export-transactions-csv-ofx-qfx
[c1-export-pending]: https://www.mindsbudget.com/guides/export-capital-one-transactions-csv
[discover-duplicates]: https://www.quicken.com/support/discover-card-downloads-same-transactions-new-subsequent-sessions/
[canada]: https://support.capitalone.ca/transactions-and-statements/how-to-view-transaction-history-and-past-statements
[intellix]: https://content.capitalone.com/TMgmt/images/Info_Reporting_Ref_Guide.pdf
[ofxtools]: https://github.com/csingley/ofxtools
[ofxtools-model]: https://github.com/csingley/ofxtools/blob/78889d1244efcd7aaea2f255ed6080d7e92bcf55/ofxtools/models/bank/stmt.py
[ofxparse]: https://github.com/jseutter/ofxparse
[reds]: https://github.com/redstreet/beancount_reds_importers/tree/c0e89235048318ce125c110629d7345ece14d177
