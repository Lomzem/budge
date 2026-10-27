# Domain docs

This repo uses a single context: `GLOSSARY.md` at the repo root and ADRs under `docs/adr/`.

## Before exploring

Read `GLOSSARY.md` and the ADRs relevant to the area you are about to work in.
If they do not exist, proceed silently. The `domain-modeling` skill creates them
lazily when terms or decisions get resolved.

## Use the glossary's vocabulary

When naming domain concepts in issues, proposals, hypotheses, or tests, use the
terms defined in `GLOSSARY.md`. If a needed concept is missing, reconsider the
wording or note the gap for `domain-modeling`.

## Flag ADR conflicts

If a proposal contradicts an existing ADR, identify the ADR and explain why the
decision should be reopened.
