# 35: Assess maintained register latency coverage

Status: needs-triage

Source: `.scratch/first-use-ux/issues/04-apply-a-confirmed-start-date-repair-safely.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/first-use-ux/issues/04-apply-a-confirmed-start-date-repair-safely.md`).

The register-blanking fix was verified with a latency harness, but no permanent delayed-query journey was retained because of runtime cost. Assess whether existing slow-response coverage protects this boundary before adding a focused regression.

Current code: src/lib/paginatedQuery.svelte wraps the register subscription; historical latency probes remain outside maintained journeys.
