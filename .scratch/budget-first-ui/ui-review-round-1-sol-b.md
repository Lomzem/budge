# Independent judge report — Sol B

**7/10 · Changes required.** Saving an Uncategorized Transaction approves it. On phones, releasing a long press on a Category name opens the inspector behind the menu, and an empty Category Group compresses the Budget table.

- **Session.** GPT-6.2-Sol, high reasoning effort. Fresh independent review. I did not read another judge’s report or evidence, or the implementer’s dispositions. I owned `/home/lomzem/proj/budge-ui` on `feat/budget-first-ui`. Starting SHA was `013243017f86f4f27fe7b5ed5932aeecfaed0218`, the worktree was clean, and `.local-app/running.json` was absent.
- **Readiness.** `app up`, `doctor`, `login`, and `seed budget-with-accounts` exited 0. Authenticated Chromium showed the Budget H1 and Assigned for Groceries. `bun run app verify … --run sol-b-round-1` exited 0 with all 15 brief journeys passing. Manual Playwright used pointer and keyboard at 1280×800 and touch emulation at 320×640 and 390×844. [Readiness][ready] · [Journey summary][journeys] · [Manual observations][obs] · [Manual driver][driver]

## Task coverage

B is the synthetic `budget-with-accounts` fixture. S is `bank-sync`. The journey summary records the result and evidence paths for each of the 15 named journeys.

| Task and entry point | Fixture and input | Result | Observation and evidence |
| --- | --- | --- | --- |
| Add, rename, reorder, move to group, hide, show and delete on Budget | B, desktop pointer and keyboard | Pass | Category and group changes persisted, including order in both directions and moving all four members of a deleted group into Everyday. [Journeys][journeys] · [Group deletion after reload][group-moved] |
| Group ⋯ and mobile Add Category or Group | B and S, desktop keyboard and both phones | Fail | The group menu was named and keyboard operable. Phone creation and deletion persisted. Adding an empty group compressed the table. See B3. [Group menu][group-menu] · [Phone add/reload][phone-add] · [Phone delete/reload][phone-delete] |
| Hidden Category, populated hidden group, and Show | B, desktop pointer and keyboard | Fail | Hidden listed Transit with $25.00 Available and Savings Goals with all four members and their balances. Both restored and survived reload. Show lost keyboard position. See B4. [Hidden Category][hidden-category] · [Hidden group][hidden-group] · [After Show and Tab][show-tab] |
| Tab and Shift+Tab, keyboard row menu, Enter and Escape | B, desktop keyboard | Pass | Tab reached Groceries between Everyday actions and Assigned for Groceries. Shift+F10 and the Context Menu key opened its menu, with Escape returning to Groceries. Arrow keys opened Move to group. Enter submitted a rename, and Escape cancelled a rename and a Delete dialog. [Submenu][submenu] · [Delete dialog][delete-dialog] · [Observations][obs] |
| Right-click, rapid dismissal, cross-row right-click, and row selection | B, desktop pointer | Pass | Right-clicking Dining Out replaced the Groceries menu, confirmed by Move up becoming enabled. Five open/Escape cycles cleared the menu. One outside click on Dining Out’s Available cell dismissed the menu and a second selected Dining Out. Pointer dismissal sometimes focused the main region. [Second right-click][right-click] · [Observations][obs] |
| Touch long press and inspector Previous/Next | B, both phones | Fail | Holding a non-control row surface passed the journey. Holding the Category name opened the menu, then releasing opened the inspector too. Previous and Next worked and focused Assigned this month. Escape from inspector actions returned to its trigger, and closing the inspector returned to the Category. See B2. [Before release][touch-before] · [After release][touch-after] · [Phone neighbors][neighbors] |
| Inspector move money, Cover, and Category management | B, desktop and 320 px | Pass | Both inspector journeys passed. Category actions and Target controls were operable. The inspector lost its accessible region name during inline rename. See B5. [Journeys][journeys] · [Rename snapshot][rename] |
| Long Category name | B, desktop and both phones | Pass | The rename persisted. The full name wrapped in the row and inspector, Close remained reachable, and Escape returned to the named row. Neighbor controls retained full accessible names. [320 px row][long-row] · [390 px inspector][long-inspector] · [Observations][obs] |
| Empty Upcoming, no Category selected, and funding status | B, desktop and 320 px | Pass | Empty Upcoming showed nothing. With no Category selected, Upcoming used the desktop side panel and followed the table on the phone. The Monthly journey showed Not funded on a short current-month Target and removed the status when funded. A short next-month Coffee Target showed its date and amount without the status. [Empty][empty-upcoming] · [Next month][upcoming] · [Journeys][journeys] |
| Terse Target summary | B, desktop | Pass | The inspector read “$59.98 monthly, due 1st”. The copy guide prefers this exact form. The brief’s example omits “monthly”. [Target snapshot][target] · [Copy guide][copy] |
| Section navigation, desktop install prompt, and loading flashes | B and S, desktop and both phones | Pass | Budget, Transactions, Bank and Settings were the four Section links. Categories and the desktop install prompt were absent. Eight switches at each size produced zero visible `Loading…` DOM observations or sampled frames after readiness. [Desktop Budget][ready] · [Phone Transactions][phone-transactions] · [Observations][obs] · [Journeys][journeys] |
| Category or Transfer from a Transaction row or dialog, Unapproved count, and Uncategorized | B and S, desktop and 320 px | Fail | A Category from either entry point and a Transfer from either entry point approved the Transaction and persisted. The manual Category dialog and both Transfer checks each reduced the count by one. Row Uncategorized preserved Unapproved. Dialog Save with Uncategorized approved the row. Bulk selection and phone approval journeys passed. See B1. [Category reload][txn-category] · [Dialog Transfer reload][txn-transfer] · [Row Transfer reload][row-transfer] · [Journeys][journeys] |
| Bank status and wording | B and S, desktop and phones | Fail | The seeded Sandbox card reported freshness and explained its disabled actions. The consent card repeated renewal advice beside Reconnect. See B6. [Journeys][journeys] · [Bank copy][bank-copy] |
| Settings Export and Cutover date | B, desktop and phones | Pass | CSV and JSON were direct buttons. Their downloads agreed on row counts across 15 tables and excluded provider data. On desktop, Escape cancelled the date edit and the later-date preview. A saved date survived reload without move history or Undo move. [Export check][export] · [Cutover reload][cutover] · [Journeys][journeys] |
| Copy across scoped screens | B, S, and empty-budget | Fail | The empty Needs you sentence, Transactions heading lede, Cutover explanation, export dialog copy, and Select a Category placeholder were absent in the exercised states. B6 remains. [Empty Budget][empty-budget] · [Transactions][phone-transactions] · [Cutover][cutover] · [Bank copy][bank-copy] |
| Ready to Assign and Budget density | B, desktop and both phones | Pass | The figure uses a smaller desktop type class and sits without a tinted box. Its label and amount fit at all three sizes. Assignment changed Ready to Assign and survived reload. Category renaming and group management left it unchanged. [Budget][ready] · [Observations][obs] · [Journeys][journeys] |

## Findings

| ID | Severity | Reproduction and impact | Evidence |
| --- | --- | --- | --- |
| B1 | Major | On Transactions with B, open Unapproved **SAMPLE HARDWARE 2208**. Choose **Uncategorized** in Category or Transfer, click **Save**, and reload. The row stayed Uncategorized but became Approved. The badge went from 3 to 2. This removes a Transaction from the review queue without the intended categorization. | [Before][uncat-before] · [Draft][uncat-draft] · [After reload][uncat-after] |
| B2 | Major | At either phone width, hold directly on the **Groceries** name until the menu opens, then lift without moving. Before release there was one menu and zero dialogs. After release Groceries was expanded, with both the menu and the inspector dialog present. The menu gesture should preserve selection. | [Before release][touch-before] · [320 px after release][touch-after] · [390 px after release][touch-390] |
| B3 | Major | At either phone width, choose **Add Category or Group → Add Category Group** and save an empty **Fixture Review Group**. Leave it expanded or reload. The new group’s name button was 0 px wide at 320 and about 15 px at 390. Credit Card Payments split into one- and two-character lines at 320. Adding its first Category through the top Add menu restored the table. Deleting that last Category and reloading reproduced the compression. | [320 px with B][empty-320] · [390 px][empty-390] · [Measurements][obs] |
| B4 | Major | Hide Transit. Reload, Tab to **Show Transit**, and press Enter. Transit returns to the table, but focus goes to the document body. The next Tab reaches **Skip to content**, restarting Budget keyboard traversal. Showing a hidden group also sent focus to the body. | [Show control][hidden-category] · [Next Tab][show-tab] · [Focus log][obs] |
| B5 | Minor | On desktop, open **Groceries → Groceries actions → Rename**. The Category name textbox gets focus, but the inspector heading disappears and its ARIA region becomes unnamed until editing ends. | [Before][inspector-menu] · [While editing][rename] |
| B6 | Minor | With S, open Bank and read the Sample Credit Union card. “Reconnect to renew it.” repeats the next action beside **Reconnect**, which fails copy review question 2. Keep the consent deadline and cut the second sentence. | [Rendered card][bank-copy] · [Source][bank-source] |

## Rubric

| Dimension | Score | Reason |
| --- | ---: | --- |
| Task completion and trust | 7/10 | Category changes, money moves, and exports persisted. Uncategorized Save removes a Transaction from review. |
| Discoverability and language | 8/10 | Four clear Sections, named buttons, and concise Target and Upcoming text. Category context actions take discovery, and the Bank consent line repeats the action. |
| Efficiency and control | 7/10 | Keyboard menus, inline rename, and phone neighbor buttons reduce repeat effort. Show restarts Tab traversal, and long press can change selection. |
| Feedback and recovery | 8/10 | Rename refusal retained the draft and focus. Loading and empty states stayed quiet. An Uncategorized Save announced only a save while dropping the review count. |
| Accessibility and input | 7/10 | Keyboard menus, named controls, and dialog focus return worked on the exercised paths. Show loses focus and inspector rename drops the region name. |
| Responsive layout and visual clarity | 6/10 | Normal pages fit both phone widths, and long names were readable. An expanded empty group distorted the phone table. |

The main flows were usable and persisted, which supports 7/10. The approval, touch, and layout defects require another round. Live Plaid sync/reconnect and real-phone home-screen installation were excluded and remain unverified. Screen-reader names and roles were reviewed through ARIA snapshots.

**Principles applied.** Prove It Works led me to reload the Uncategorized edit and count the remaining Unapproved Transactions, and to check the active element and next Tab after Show. Guard the Context Window led me to keep full snapshots local and use targeted extracts from this run.

**Release.** All Playwright browsers closed. `bun run app down` exited 0, `.local-app/running.json` was absent, and the tracked tree remained clean at the reviewed SHA. Both evidence directories survived teardown. All evidence files were nonempty except five CSVs for intentionally empty export tables. Checkout ownership released. [Teardown][down] · [Journey evidence][journeys] · [Manual evidence][obs]

[ready]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/readiness.png
[journeys]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1/summary.json
[obs]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/observations.ndjson
[driver]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/manual.ts
[group-moved]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry2-groups-populated-delete-reload.aria.yml
[group-menu]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry3-menus-group-keyboard-menu.aria.yml
[phone-add]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/320-baseline-add-add-category-reload.aria.yml
[phone-delete]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/390-add-delete-category-reload.aria.yml
[hidden-category]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry2-groups-hidden-category-reload.aria.yml
[hidden-group]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry2-groups-hidden-group-reload.aria.yml
[show-tab]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry2-groups-show-category-next-tab.png
[submenu]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/keyboard-deep-row-submenu-keyboard.aria.yml
[delete-dialog]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/keyboard-deep-delete-category-dialog.aria.yml
[right-click]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry3-menus-row-menu-after-second-right-click.aria.yml
[touch-before]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/320-touch-touch-menu-before-release.aria.yml
[touch-after]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/320-touch-touch-menu.aria.yml
[touch-390]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/390-touch-touch-menu.aria.yml
[neighbors]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/320-touch-touch-neighbors.aria.yml
[rename]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry3-menus-inspector-rename-focus.aria.yml
[long-row]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/320-long-long-name-row.png
[long-inspector]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/390-steady-long-long-name-inspector.png
[empty-upcoming]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry-targets-empty-upcoming.aria.yml
[upcoming]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry-targets-upcoming-with-target.aria.yml
[target]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry-targets-target-terse.aria.yml
[copy]: /home/lomzem/proj/budge-ui/docs/quality/copy-review.md
[phone-transactions]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/320-route-transactions.aria.yml
[txn-category]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry2-approval-dialog-category-reload.aria.yml
[txn-transfer]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/bank-approval-dialog-transfer-reload.aria.yml
[row-transfer]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/bank-row-approval-dialog-transfer-reload.aria.yml
[bank-copy]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1/shell/phone-pages/03-bank-loads-in-place-and-scrolls-to-its-end.aria.yml
[export]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/export-check.log
[cutover]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry2-cutover-cutover-forward-reload.aria.yml
[empty-budget]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/empty-copy-empty-budget.aria.yml
[uncat-before]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry2-approval-uncategorized-before.aria.yml
[uncat-draft]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry2-approval-uncategorized-dialog-draft.aria.yml
[uncat-after]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry2-approval-uncategorized-after-reload.aria.yml
[empty-320]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/320-baseline-add-empty-group-layout.png
[empty-390]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/390-add-empty-group-layout.png
[inspector-menu]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/retry3-menus-inspector-keyboard-menu.aria.yml
[bank-source]: /home/lomzem/proj/budge-ui/src/lib/components/bank/connection-card.svelte:112
[down]: /home/lomzem/proj/budge-ui/test-results/verify-budge/sol-b-round-1-manual/teardown.log
