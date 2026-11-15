# Independent affected UI recheck — round 3

## Scope and assignments

The shared neutral brief is [ui-final-recheck-brief.md](../ui-final-recheck-brief.md), with the [spec](../spec.md), [protocol](../../../docs/quality/ui-review/README.md), [rubric](../../../docs/quality/ui-review/rubric.md) and report template. All judges inspected clean `417d273986dc93485e7e762a32ed3efed964b20f`; last application change is `ce0dad7`.

Each fresh judge used an isolated checkout, anonymous backend, authenticated browser and private evidence. Each read only its own prior full report at `e4c4634`, checked the source diff, explicitly justified unchanged evidence, and freshly exercised the affected phone/desktop Escape, nested layers, focus, money effects and touch organizing. The reports contain the actual checkouts, task/input matrices, evidence paths and cleanup results.

## Independent approvals

| Judge | Model and effort | Overall | Report | Fresh maintained journeys |
| --- | --- | ---: | --- | ---: |
| Sol A | GPT-6.1-Sol High | 9/10 | [sol-a.md](../reviews/ui-round-3/sol-a.md) | 4 |
| Sol B | GPT-6.1-Sol High | 9/10 | [sol-b.md](../reviews/ui-round-3/sol-b.md) | 4 |
| Opus | Opus 5.5 medium | 9/10 | [opus.md](../reviews/ui-round-3/opus.md) | 6 |

All three explicitly approve the same SHA with full scoped coverage and no open major or blocker. The parent inspected each report and its exact-clean-SHA journey summary. All browsers and apps were closed, evidence retained, and checkout ownership released. Scores were neither averaged nor silently carried forward.

## Dispositions and limits

- Prior `sol-a-A1`: fixed in `ce0dad7`, independently verified by all three. Dirty Move Escape clears the form and retains the inspector with picker focus; clean Escape closes and returns to its opener. Target, Delete and Command layers consume their own Escape. No reset or dismissal writes money.
- `sol-a-R3-N1`: deferred to [follow-up 09](09-ui-polish-followups.md). Heavy Group-label wrapping adds scanning friction in the large-money phone case; names, digits and controls remain visible and usable.
- Opus's localized minor findings and nits remain explicitly deferred in follow-up 09, including the newly observed stale Move refusal until resubmission. No finding is claimed fixed without evidence.
- Physical hardware, live Plaid and owner production authentication remain outside local verification. Readability is proven for the specified 999999.99 Assigned and seven-figure Group totals, not all server-admitted values.

**Gate passed at inspected revision `417d273`.** This report archive and ticket closeout change documentation only. Before shipping a newer documentation-only head, obtain each judge's explicit confirmation for that same final SHA and record it in the PR description and retained shipping evidence. Any further application change requires fresh affected inspection.
