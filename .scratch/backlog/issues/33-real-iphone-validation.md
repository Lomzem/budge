# 33: Complete real iPhone Home Screen checks

Status: ready-for-human

Source: `.scratch/v1/issues/23-production-go-live.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/v1/issues/23-production-go-live.md`).

Check standalone launch, both sign-in methods, background refresh, re-sign-in after seven days, safe areas and status bar in both themes. Also verify native keyboard interactions; desktop emulation is insufficient.

Current code: static/manifest.webmanifest and online app exist; recorded production smoke explicitly excludes physical devices. Source inspection only; historical browser findings need reproduction before implementation.
