#!/usr/bin/env bash
# Usage: timing.sh <run-id> <attempt>  — wall clock, per-job and per-step seconds for one attempt.
set -euo pipefail
gh api "repos/{owner}/{repo}/actions/runs/$1/attempts/$2/jobs?per_page=50" --jq '
  def s(a;b): ((b|fromdateiso8601) - (a|fromdateiso8601));
  ([.jobs[].started_at] | min) as $t0 | ([.jobs[].completed_at] | max) as $t1 |
  "wall \(s($t0;$t1))s",
  (.jobs[] | "\(.name)\t\(.conclusion)\t\(s(.started_at;.completed_at))s",
    (.steps[] | select(.conclusion=="success" and (.name|test("^(Set up|Post|Complete)")|not)) | "    \(.name)\t\(s(.started_at;.completed_at))s"))'
