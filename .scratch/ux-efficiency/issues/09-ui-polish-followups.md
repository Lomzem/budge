# 09 — UI polish follow-ups

Status: needs-triage

These localized findings are deferred from the 26-item delivery for the reasons below. They are recorded, not claimed fixed. Reproduce and design each follow-up before implementation. IDs distinguish later observations from similarly numbered round-1 findings.

| Finding | Follow-up | Reason for deferral |
| --- | --- | --- |
| Round-2 Opus 1: last year digit clipped in native From/To inputs at 320px | Check native date rendering in Chromium and on a physical phone | The full range remains in the accessible chip and URL, and filtering persists correctly. Native control sizing needs separate browser coverage. |
| Round-2 Opus 2: held Cover/Move completes silently after leaving its inspector | Decide ownership of completion feedback outside the keyed inspector | Money and persistence are correct, and the new Category's draft/focus are preserved. Global feedback needs an app-level owner. |
| Round-2 Opus 3: twelve month Tab stops | Assess a roving grid tabindex | Required keyboard tasks complete. Refine keyboard travel without disturbing year/grid focus. |
| Round-2 Opus 4: large Group total sits flush right | Refine narrow financial alignment | All digits are readable. Padding changes need their own narrow-layout checks. |
| Round-2 Opus 5: inspector region temporarily unnamed during Rename | Retain a stable accessible region name | The focused Rename input remains named and the task completes. Check all rename/error states. |
| Round-2 Opus 6: backward Tab prefills a split remainder | Review prefill intent during backward navigation | Existing behavior outside the 26 items; visible overage and validation provide recovery. Changing money-entry defaults needs a separate interaction decision. |
| Round-2 Opus 7: some 40px touch targets and unmeasured dialog hit areas | Measure actual hit areas before changing controls | Observed targets exceed the 24px minimum; some visible boxes already have larger touch areas. |
| Round-3 Sol A N1: heavy Group-label wrapping with large phone amounts | Refine Group header density | Names, amounts and controls remain usable. Preserve the measured financial readability when changing layout. |
| Round-3 Opus 8: Move refusal remains after correcting Amount | Consider clearing validation on the relevant draft edit | Existing validate-on-submit behavior; invalid saves are still refused, and Clear/resubmit recovers. |

The required phone case (999999.99 Assigned and seven-figure Group totals) is readable. Larger server-valid amounts, up to 10B, are not certified and may clip. A follow-up should verify readability across the admitted range; storage validity does not prove display readability.

Original observations and evidence paths are retained in the independent reports. These deferrals waive no major, blocker or missing required task. The separate phone Escape correction is fixed and approved.
