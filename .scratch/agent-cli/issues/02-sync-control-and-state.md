# 02: Sync control and state inspection

**What to build:** An agent can trigger bank sync paths and read back the resulting rows without the UI.

**Blocked by:** 01; v1 tickets 18–21 merged

**Status:** needs-triage

- [ ] `sync [connection]` runs the internal sync that Sync now and the webhook use, via `convex run`, on the local or dev deployment.
- [ ] `cron daily` runs the function the daily cron calls.
- [ ] `fire-webhook <code>` asks Plaid Sandbox to send a real webhook to the cloud dev deployment. No test-only signing key or verification bypass in production code.
- [ ] `state <table>` prints a summary of rows. Redacted by default: never prints Bank Connection tokens or `provider`.
- [ ] Refuses production deployments.
