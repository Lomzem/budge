# 02: Keep generating commands from reloading a driven app

Status: needs-triage

Source: `.scratch/agent-ergonomics/issues/06-generators-respect-running-app.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/agent-ergonomics/issues/06-generators-respect-running-app.md`).

Measure generated writes, then avoid no-op writes or serialize generating commands with app verification. Prove no-op checks cannot discard a selection or draft.

Current code: scripts/codegen.js unconditionally writes generated server files; package.json still invokes sync from typecheck. Source inspection only; historical browser findings need reproduction before implementation.
