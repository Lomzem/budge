# What does the data model look like in Convex?

Type: grilling
Status: open
Blocked by: 06, 07, 14, 15

## Question

What tables, fields, and indexes does the Convex schema need to support the budget rules and the import flow: money representation, month keys, Accounts, Transactions and splits, Categories and Category Groups, Assigned per month, Payees, Bank Connections, and encrypted secrets?

## Comments

- From [Where does Effect go in Budge?](14-effect-boundaries.md): `v.*` validators own tables and function contracts (types inferred, no hand-written mirrors); Effect Schema decodes only external data. Bank Connection tokens go through a `TokenCipher` service (AES-GCM, key in Convex env).
