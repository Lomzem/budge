# 14: Maintain positive and negative layout-shift guard checks

Status: needs-triage

Source: `.scratch/ux-efficiency/issues/09-ui-polish-followups.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/ux-efficiency/issues/09-ui-polish-followups.md`).

Create a credential-free browser-test home. Native and routed unsolicited shifts must fail while a held-request refusal is attributed correctly. Scratch probes are not maintained regression coverage.

Current code: e2e/journeys/layoutShift.ts patches native/routed WebSockets; no isolated browser harness is maintained. Source inspection only; historical browser findings need reproduction before implementation.
