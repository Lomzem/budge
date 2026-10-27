# Connect real accounts through the chosen aggregator and capture sample data

Type: task
Status: open
Blocked by: 01

## Question

Sign up for the aggregator chosen in ticket 01, connect the real Capital One and Discover accounts, and capture redacted sample payloads (accounts, pending and posted transactions) so the import flow and data model can be judged against real data. Record where credentials live (never in the repo).

Per ticket 01: apply for Plaid Trial first; check whether the Discover card has moved to a Capital One login before linking, and avoid creating duplicate Items (10 lifetime). Fall back to SimpleFIN Bridge if Plaid eligibility or linking fails.
