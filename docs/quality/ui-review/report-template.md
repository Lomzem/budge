# UI review — <feature>, round <N>

Use [the protocol](README.md) and [rubric](rubric.md). Copy this template into the feature's issue directory. Replace placeholders with observed facts; leave missing proof explicitly blocked/unverified.

## Coordinator brief

- Spec/tickets and intended outcomes:
- In-scope tasks and entry points; exclusions:
- Clean reviewed SHA and branch; final SHA if changed:
- Feature IDs, named journeys, synthetic fixtures and extra setup:
- Required task/viewports/input/state matrix (include desktop, narrow phone, keyboard):
- Expected observable outcomes:
- Checks/corrections completed (commands, exit codes, revision):
- Known external limitations and required verification gaps:
- Session assignments: judge → checkout → exclusive time slot → report path:

## Independent judge report — <Sol A / Sol B / Opus>

Repeat in each judge's own report file before aggregation.

- Actual model and reasoning setting; unavailable slot if applicable:
- Fresh context / independence declaration:
- Reviewed SHA, clean-tree confirmation, checkout and session owner:
- App readiness and authenticated fixture confirmation (sanitized):

| Task / entry point / journey | Fixture             | Viewport and input mode        | Observed outcome / persistence | Evidence path    | Pass / fail / unverified |
| ---------------------------- | ------------------- | ------------------------------ | ------------------------------ | ---------------- | ------------------------ |
| <task>                       | <synthetic fixture> | <size; keyboard/touch/pointer> | <observation>                  | <local artifact> | <result>                 |

| Finding ID | Severity                  | Task and reproduction | Expected vs observed / user impact | Evidence |
| ---------- | ------------------------- | --------------------- | ---------------------------------- | -------- |
| <judge-N>  | <blocker/major/minor/nit> | <steps>               | <impact>                           | <path>   |

| Rubric dimension                     | Score /10 or unverified | Observation supporting judgment |
| ------------------------------------ | ----------------------- | ------------------------------- |
| Task completion and trust            |                         |                                 |
| Discoverability and language         |                         |                                 |
| Efficiency and control               |                         |                                 |
| Feedback and recovery                |                         |                                 |
| Accessibility and input              |                         |                                 |
| Responsive layout and visual clarity |                         |                                 |

- Overall score /10 and rationale (provisional if coverage incomplete):
- Unverified tasks/external behavior and blockers:
- Verdict: approve / changes required / blocked:
- Cleanup result, ownership release, evidence retained after teardown:

## Coordinator disposition and final gate

| Finding ID | Fixed / answered / deferred | Commit, check and counter-evidence or reason + follow-up | Affected judge's re-check result and SHA |
| ---------- | --------------------------- | -------------------------------------------------------- | ---------------------------------------- |
| <ID>       | <disposition>               | <evidence>                                               | <result>                                 |

- Changes since initial review; affected tasks/approvals invalidated:
- Re-run checks/journeys with commands, exit codes, revision and evidence:
- Carry-forward rationale for unaffected evidence; judge confirmation links:

| Judge | Actual model / reasoning | Final SHA explicitly approved | Separate overall score /10 | Report / re-check evidence | Required coverage complete; no open blocker/major |
| ----- | ------------------------ | ----------------------------- | -------------------------- | -------------------------- | ------------------------------------------------- |
| Sol A |                          |                               |                            |                            |                                                   |
| Sol B |                          |                               |                            |                            |                                                   |
| Opus  |                          |                               |                            |                            |                                                   |

- Remaining gaps, unavailable reviewers and follow-ups:
- Cleanup and evidence retention confirmed for every session:
- Gate: pass / incomplete, with reason (apply protocol; never average scores):
