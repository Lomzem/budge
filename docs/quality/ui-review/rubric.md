# UI review rubric

Use with [the protocol](README.md). Assess each dimension from actual scoped tasks, with concrete observations. Record a dimension score out of 10 or `unverified`, then give a separate overall judgment out of 10 with reasons. The overall score is not an arithmetic average.

| Dimension                            | Inspect                                                                                                                                                                            | Blocker / major examples                                                                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task completion and trust            | Can the user complete the intended task, understand money/state changes, and verify the result after reload?                                                                       | Blocker: saving changes the wrong Transactions or loses money data. Major: a successful Bank Connection is presented as proof that a balance is correct.                                           |
| Discoverability and language         | Is the next action clear, with concise routine status and details at the decision? Use the glossary's terms.                                                                       | Major: the user cannot find Category editing or distinguish an Account from a Bank Connection without outside instructions.                                                                        |
| Efficiency and control               | Can repeated work be done efficiently with visible scope, deliberate defaults, cancellation and undo where promised?                                                               | Major: a bulk action silently includes unseen rows, or a one-off edit silently changes remembered Categories.                                                                                      |
| Feedback and recovery                | Are loading, empty, success, refusal and failure states truthful, timely, and actionable?                                                                                          | Major: Sync reports success while hiding waiting Account setup; a validation error gives no usable recovery action.                                                                                |
| Accessibility and input              | Keyboard completion, visible/logical focus and return, accessible names/announcements, headings, contrast, reduced motion and target sizes. Check applicable WCAG 2.2 AA behavior. | Blocker: keyboard users cannot complete a required task. Major: dialog focus disappears after save, or primary phone actions are too small to use reliably (aim for 44 px; minimum targets 24 px). |
| Responsive layout and visual clarity | Typography, hierarchy, spacing, color, clipping, long content, scroll reachability, and stability on load/navigation/async results.                                                | Blocker: phone Save is unreachable behind the tab bar. Major: a pinned header hides the active field, or asynchronous reflow moves the action being targeted.                                      |

## Severity and scoring

- **Blocker:** prevents a required task, risks destructive/wrong financial outcomes, or excludes a required input mode with no usable path.
- **Major:** materially confuses, misleads, or burdens a required task even if a workaround exists. A reproducible major cannot be waived by a high overall score.
- **Minor:** localized friction with an obvious, reliable path to completion.
- **Nit:** cosmetic preference with negligible task impact.

Overall anchors:

| Score | Meaning                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------- |
| 1–4   | Core tasks fail or trust/access is seriously compromised.                                                       |
| 5–6   | Tasks partly work but substantial confusion, recovery, or layout problems remain.                               |
| 7–8   | Usable, with at least one material problem or enough friction to require another fix round.                     |
| 9     | Clear, efficient and trustworthy across required tasks/viewports; only justified minor findings or nits remain. |
| 10    | All scoped tasks feel resolved, with no meaningful friction observed.                                           |

Explain the score using observations, not a target of reaching 9. Required coverage gaps mean provisional assessment and an incomplete gate, even if observed tasks look excellent. The protocol defines the approval rule and re-check loop.
