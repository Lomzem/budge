# UI review — UX efficiency, round 1

Use [protocol](../../../docs/quality/ui-review/README.md), [rubric](../../../docs/quality/ui-review/rubric.md) and [template](../../../docs/quality/ui-review/report-template.md).

## Coordinator brief

- Spec/tickets, outcomes, all26 item mappings, tasksU1–U8, entry points, synthetic fixtures, exclusions, required viewport/input/state coverage and expected outcomes: [shared brief](../review-brief.md). Every judge receives the same brief.
- Clean revision: coordinator pins the exact HEAD in each fresh task after local repair rechecks; last code is `cec8434`. Branch `feat/ux-efficiency`.
- Checks, correction dispositions, supported lifecycle readiness and unchanged-backend capacity evidence: shared brief and ticket03. No judge score exists at preparation time.
- Session assignments: independent Sol A High, Sol B High and Opus5.5, each in its own orchestrator-provisioned worktree at the same pinned SHA. Each exclusively owns its anonymous backend, browser, private login state and artifacts. Actual checkout path and release are recorded in that judge's report. No shared backend or parent-checkout app use.
- Separate report destinations: each judge's checkout `test-results/ux-efficiency/ui-review/sol-a.md`, `sol-b.md`, or `opus.md`. Use the maintained template including per-task coverage, findings, dimension scores, separate overall judgment, exact reviewed SHA, limits and cleanup.

## Independent judge reports

- SolAHigh completed at `7aa0bbe5b5b1e8b8eaaf047b0c4f57643679adbf`: **8/10, changes required**, one major `sol-a-1`. [Report](../reviews/ui-round-1/sol-a.md).25 maintained journeys passed; allU1–U8 exercised, U4 fails month context on Back. Browser/app cleaned up and checkout released.
- Opus5.5 completed at the sameSHA: **9/10, approve**, no major/blocker and no required coverage gaps;24 maintained journeys passed plus manual tasks at desktop/phone/keyboard. [Report](../reviews/ui-round-1/opus.md). Five minor/nit findings require disposition. Cleanup complete and ownership released. Opus's simpler month-return sample passed; it did not exercise SolA's reload→second month→leave→Back sequence. Its approval does not answer that demonstrated failure.
- SolBHigh completed at the sameSHA: **8/10 provisional, changes required**, major `sol-b-1` and explicit required input/viewport combinations unverified. [Report](../reviews/ui-round-1/sol-b.md).23 maintained journeys passed; cleanup complete and ownership released. All3 independent reports are now delivered.

## Coordinator disposition and final gate

Pending. Each finding will have a fixed/answered/deferred disposition and evidence. All3 judges must independently approve the same final SHA at>=9/10 with required coverage complete and no open major/blocker. A change after judging requires affected reinspection; documentation-only changes require each judge's explicit carry-forward confirmation for the final SHA.

| Finding | Severity | Disposition and evidence |
| --- | --- | --- |
| sol-a-1: June2027 reload → July2027 → Categories → Back restores June rather than July | major | Open; source and touch/pointer/keyboard evidence inspected by parent. Raw reproduction: original SolA checkout test-results/verify-budge/sol-a-manual/history/observations.json and final keyboard captures. Batch repair after other independent judges finish. |
| opus-1: table Target funding action24px tall on phone | minor | Pending Opus implementor disposition; minimum met,44px aim missed. |
| opus-2: Group Add Category+24x24 on phone | minor | Pending disposition; full-size alternative exists. |
| opus-3: removing split line sends focus to Account picker | minor, also on main | Pending disposition; existing flow now touched by optional memo changes. |
| opus-4: Cover/Move success lacks polite announcement | nit | Pending disposition. |
| opus-5: Move form lacks Cancel/Clear | nit | Pending disposition; Escape closes inspector. |
| sol-b-1:390px large persisted Assigned/Available clip and Group totals run together | major | Open, assigned to running Opus repair batch. Parent inspected actual screenshot and measurements: Assigned scrollWidth110>clientWidth94 with999999.99 saved;320px stack fits. |
| SolB required coverage incomplete | gate gap | Fresh SolB reinspection must complete strict keyboard Target/date preset chains;320touch actualdifferentAccount+heldduplicate/lateentrysave,customdates,fullsplitadd/remove/restart;keyboardfullsplitlifecycle. Correct helper recipes rather than assume helper failures are appdefects. |

Gate: incomplete; scores8,8provisional,9. SolA/SolB major findings and required coverage gaps block shipping. Any repairs need fresh affected reinspection and final sameSHA approval from all3.
