# 15: Consider visible touch cancellation for inline names

Status: needs-triage

Source: `.scratch/ux-efficiency/issues/10-coderabbit-repairs.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/ux-efficiency/issues/10-coderabbit-repairs.md`).

Refused blank inline names have no visible Cancel. Keyboard Escape works; assess a touch action across Category, Group and inspector editors.

Current code: src/lib/components/categories/inline-name.svelte handles Escape but exposes no Cancel button. Source inspection only; historical browser findings need reproduction before implementation.
