# 06 — Repair three-judge UI audit findings

Status: ready-for-agent

Fresh Opus owns production/UI fixes from round1. Primary required repair is sol-a-1: changing viewed Budget month after reload, navigating to Categories, then Back must restore the last-viewed month. Preserve explicit deep links, current-month URL convention, cutover boundary and deliberate history semantics; test the user-visible context and actual monthly assignments.

Disposition every Opus minor/nit from round1 explicitly with fixed/answered/deferred and reason. Prefer focused polish that improves the approved flows; avoid unrelated redesign. SolB's report is still independent/pending at7aa0bbe; its eventual findings will join this repair batch. Never share other judges' scores/verdicts with a still-running judge.

Use existing public journeys and verify-budge. Preserve evidence at desktop1280x800,phone320x640 touch,keyboard and relevant390/dark states. Reproduce required bug before fix, prove after navigation/reload and correct money/month. Update feature map for changed coverage; test-audit every new/changed test. Full source review and fresh affected UI judging remain parent gates. Do not mark ticket done before those gates.

Implementation/checks/evidence/dispositions: pending.
