# How often does sync run, and what happens when a Bank Connection breaks?

Type: grilling
Status: open
Blocked by: 

## Question

With Plaid chosen ([Which aggregator syncs Capital One and Discover for at most $25 a year?](01-bank-sync-provider.md)) and the import flow decided ([How do synced Transactions arrive?](07-import-flow.md)): does sync run on Plaid's `SYNC_UPDATES_AVAILABLE` webhook, on a schedule, on manual refresh, or a mix; how is freshness shown (last synced time per Bank Connection); and what happens when a Bank Connection needs re-authentication (yearly Capital One consent renewal, Discover's migration to Capital One logins changing external IDs), including how the owner is told and how Link update mode is entered?
