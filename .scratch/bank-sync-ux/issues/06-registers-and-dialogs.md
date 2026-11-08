# 06: Registers, Categories, dialogs and sign-in on the new system

**Status:** done

**Spec:** [Bank sync and UI/UX](../spec.md)

**Blocked by:** 02, 03

## What to build

See the spec scope item.

## Comments

- Landed: registers use a fixed table layout with set column widths. Long text truncates in its cell, so loading rows never resizes columns.
- The register toolbar (Add Transaction, Import file, Approve) sits above search. Approve is always present: disabled at zero and fixed-width as its count changes.
- Search gets a full row at narrow widths. The Category, Payee and date filters sit behind a Filters toggle that shows how many are active. Clear is always present and disabled until something is set.
- A filter whose options fail to load says so in its own select.
- Register, Account header, Categories and every dialog error or status line render in a reserved slot instead of appearing and pushing content.
- Budget rows always reserve their status line, so a row keeps its height when "Funded" or "Overspent" appears.
- Categories is a set of group cards with a single actions menu per row. Hidden items carry a Hidden tag.
- Sign-in has the brand mark and one line on what Budge does. Clerk's card area is reserved before Clerk mounts, so the heading doesn't jump.
- Deferred: a background sync that adds rows still inserts them at the top of an open register. Holding them behind a reserved "N new rows, Show" line needs a register snapshot model; tracked for ticket 07.
